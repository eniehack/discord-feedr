import { writeAll } from "https://deno.land/std@0.201.0/streams/mod.ts"
import { Webhook } from "https://deno.land/x/harmony@v2.9.0/mod.ts";
import { z } from "https://deno.land/x/zod@v3.16.1/mod.ts";
import { parseFeed } from "https://deno.land/x/rss@1.0.0/mod.ts";
import { sleep } from "https://deno.land/x/sleep/mod.ts";

const configSchema = z.record(
    z.string().url(),
    z.array(
        z.object({
            template_file: z.string(),
            feed_url: z.string().url(),
        }),
    ),
);

const timestampSchema = z.record(
    z.string().url(),
    z.string(),
);

const configTxt = await Deno.readTextFile("config.json");
const configjson = JSON.parse(configTxt);

const config = configSchema.safeParse(configjson);
if (!config.success) {
    console.error(`config: ${config.error}`);
    Deno.exit();
}

const timeTxt = await Deno.readTextFile("timestamp.json");
const timejson = JSON.parse(timeTxt);

const timestamp = timestampSchema.safeParse(timejson);
if (!timestamp.success) {
    console.error(`timestamp: ${timestamp.error}`);
    Deno.exit();
}

for ( const [webhook_url, v] of Object.entries(config.data) ) {
    const webhook = await Webhook.fromURL(webhook_url);
    for ( const val of v ) {
        sleep(1);
        const resp = await fetch(val.feed_url, {
            headers: {
                "User-Agent": "discord-feedr (+https://github.com/eniehack/discord-feedr)"
            }
        });
        if (!resp.ok) {
            writeAll(Deno.stderr, (new TextEncoder()).encode("request err"));
            Deno.exit();
        }
        const { entries } = await parseFeed(await resp.text());
        const lastLoadTimestamp = new Date(timestamp.data[val.feed_url])
        for (const [_, entry] of entries.entries()) {
            sleep(1);
            console.log(entry);

            let date: Date;
            if (entry.published !== undefined) {
                date = entry.published;
            } else if (entry.updated !== undefined) {
                date = entry.updated;
            } else {
                continue;
            }
            if (lastLoadTimestamp <= date) {
                await webhook.send(`${entry.title?.value} - ${date.toString()}\n${entry.links[0].href}`, {name: "feedr"});
                timestamp.data[val.feed_url] = (new Date()).toISOString()
            }
        }
    }
}

await Deno.writeTextFile("./timestamp.json", JSON.stringify(timestamp.data));
