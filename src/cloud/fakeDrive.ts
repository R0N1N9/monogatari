/**
 * An in-memory stand-in for the Google Drive API, for tests. It implements just
 * the calls monogatari makes, with the same URLs, version numbers that increase
 * on every change, and 401 when the token is wrong.
 */
export class FakeDrive {
  files = new Map<string, { name: string; parents: string[]; content: string; version: number; modified: number }>();
  calls: string[] = [];
  validToken = "good-token";
  private nextId = 1;
  private clock = 1;

  /** Change the file as another device would. */
  writeFromElsewhere(content: string) {
    const f = [...this.files.values()][0];
    if (!f) throw new Error("no file yet");
    f.content = content;
    f.version++;
    f.modified = this.clock++;
  }

  content(): string | undefined {
    return [...this.files.values()][0]?.content;
  }

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    this.calls.push(`${method} ${url.pathname}${url.search.includes("alt=media") ? "?alt=media" : ""}`);
    const auth = new Headers(init.headers).get("Authorization");
    if (auth !== `Bearer ${this.validToken}`) return json({ error: "unauthorized" }, 401);

    const p = url.pathname;
    if (method === "GET" && p === "/drive/v3/files") {
      const name = /name='([^']+)'/.exec(url.searchParams.get("q") ?? "")?.[1];
      const files = [...this.files.entries()]
        .filter(([, f]) => f.name === name && f.parents.includes("appDataFolder"))
        .sort((a, b) => b[1].modified - a[1].modified)
        .map(([id, f]) => ({ id, version: String(f.version) }));
      return json({ files });
    }
    const fileMatch = /^\/(?:upload\/)?drive\/v3\/files\/([^/]+)$/.exec(p);
    if (method === "GET" && fileMatch) {
      const f = this.files.get(fileMatch[1]);
      if (!f) return json({ error: "not found" }, 404);
      if (url.searchParams.get("alt") === "media") return new Response(f.content, { status: 200 });
      return json({ version: String(f.version) });
    }
    if (method === "PATCH" && fileMatch) {
      const f = this.files.get(fileMatch[1]);
      if (!f) return json({ error: "not found" }, 404);
      f.content = String(init.body);
      f.version++;
      f.modified = this.clock++;
      return json({ id: fileMatch[1], version: String(f.version) });
    }
    if (method === "POST" && p === "/upload/drive/v3/files") {
      const body = String(init.body);
      const parts = body.split(/--monogatari-[a-z0-9]+(?:--)?\r?\n?/).filter((s) => s.trim());
      const [metaPart, contentPart] = parts.map((s) => s.split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, ""));
      const meta = JSON.parse(metaPart);
      const id = `file${this.nextId++}`;
      this.files.set(id, { name: meta.name, parents: meta.parents, content: contentPart, version: 1, modified: this.clock++ });
      return json({ id, version: "1" });
    }
    return json({ error: `unexpected ${method} ${p}` }, 400);
  };
}

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });
}
