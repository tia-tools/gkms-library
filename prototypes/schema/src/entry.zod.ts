import { parse } from "./idols.zod.ts";

// A minimal page: fetch the file, check it, show the count.
const res = await fetch("/data/idols.json");
document.body.textContent = String(parse(await res.json()).idols.length);
