import { parse } from "./idols.valibot.ts";

// A minimal page: fetch the file, check it, show the count.
const res = await fetch("/data/idols.json");
document.body.textContent = String(parse(await res.json()).idols.length);
