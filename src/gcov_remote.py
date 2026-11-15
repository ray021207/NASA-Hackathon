"""Read a window of a NISAR GCOV granule over HTTPS (HTTP range requests) instead of downloading the whole 7 GB file.
The Earthdata token comes from .env (EARTHDATA_TOKEN) and is never printed. h5py reads through RangeFile, which fetches only the blocks it needs.
Usage as a library: open_granule(result) -> h5py.File."""
import io, os, pathlib
import asf_search as asf
import h5py
ROOT = pathlib.Path(__file__).resolve().parent.parent


def session():
    tok = None
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("EARTHDATA_TOKEN="):
            tok = line.split("=", 1)[1].strip().strip('"')
    if not tok:
        raise SystemExit("EARTHDATA_TOKEN not found in .env")
    return asf.ASFSession().auth_with_token(tok)


class RangeFile(io.RawIOBase):
    """Read-only file object backed by HTTP Range requests with a small block cache."""
    def __init__(self, url, sess, block=4 << 20, max_blocks=64):
        self.url, self.s, self.block, self.max = url, sess, block, max_blocks
        self.pos = 0
        self.cache = {}
        self.order = []
        self.requests = 0
        self.bytes = 0
        r = sess.get(url, headers={"Range": "bytes=0-0"}, stream=True)
        r.raise_for_status()
        self.size = int(r.headers["Content-Range"].split("/")[1])
        self.final_url = r.url
        r.close()

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def _block(self, i):
        if i in self.cache:
            return self.cache[i]
        a = i * self.block
        b = min(a + self.block, self.size) - 1
        for attempt in range(4):
            try:
                r = self.s.get(self.final_url, headers={"Range": f"bytes={a}-{b}"}, timeout=120)
                r.raise_for_status()
                break
            except Exception:
                if attempt == 3:
                    raise
        data = r.content
        self.requests += 1
        self.bytes += len(data)
        self.cache[i] = data
        self.order.append(i)
        if len(self.order) > self.max:
            self.cache.pop(self.order.pop(0), None)
        return data

    def readinto(self, buf):
        n = len(buf)
        if self.pos >= self.size:
            return 0
        n = min(n, self.size - self.pos)
        out = bytearray()
        p = self.pos
        while len(out) < n:
            i, off = divmod(p, self.block)
            blk = self._block(i)
            take = min(n - len(out), len(blk) - off)
            out += blk[off:off + take]
            p += take
        buf[:n] = out
        self.pos += n
        return n

    def read(self, n=-1):
        if n < 0:
            n = self.size - self.pos
        b = bytearray(n)
        k = self.readinto(b)
        return bytes(b[:k])


def open_granule(result, sess=None):
    sess = sess or session()
    f = RangeFile(result.properties["url"], sess)
    return h5py.File(f, "r"), f
