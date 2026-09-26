import "dotenv/config";

import { connectDb } from "./db.js";
import { downloadImage } from "./downloadImage.js";
import { generateArticleImage } from "./imageGen.js";
import { generatePixelArt } from "./pixelArt.js";
import { compressImage, toDataUri } from "./imageOptimize.js";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");

async function main() {
  const { client, articles } = await connectDb(MONGODB_URI);

  try {
    // Articles ingested before downloadImage.js existed have a live
    // publisher URL sitting in `image` instead of a stored data URI — the
    // exact hotlinking this field is meant to avoid. Re-download and
    // replace those first; anything that fails to redownload is cleared so
    // it falls into the missing-image pass below instead of quietly staying
    // a hotlink.
    const hotlinked = await articles
      .find({ image: { $regex: /^https?:\/\// } })
      .toArray();

    console.log(`${hotlinked.length} article(s) have a hotlinked image URL to replace.`);

    for (const article of hotlinked) {
      console.log(`Downloading: ${article.title}`);
      const image = await downloadImage(article.image);
      await articles.updateOne({ _id: article._id }, { $set: { image: image ?? null } });
      console.log(image ? `Replaced with stored copy: ${article.slug}` : `Download failed, cleared: ${article.slug}`);
    }

    // Stored images (downloaded or AI-generated) from before imageOptimize.js
    // existed are full-size — they get embedded as data URIs on every page
    // that features them (homepage, archive, tag pages, related stories, and
    // their own page), so an uncompressed original multiplies fast. Recompress
    // anything that isn't already our WebP output.
    const uncompressed = await articles
      .find({ image: { $regex: /^data:image\/(?!webp)/ } })
      .toArray();

    console.log(`${uncompressed.length} stored image(s) need compressing to WebP.`);

    for (const article of uncompressed) {
      try {
        const base64 = article.image.slice(article.image.indexOf(",") + 1);
        const original = Buffer.from(base64, "base64");
        const compressed = await compressImage(original);
        await articles.updateOne({ _id: article._id }, { $set: { image: toDataUri(compressed) } });
        console.log(`Compressed: ${article.slug} (${original.byteLength} -> ${compressed.buffer.byteLength} bytes)`);
      } catch (err) {
        console.warn(`Failed to compress ${article.slug}: ${err.message}`);
      }
    }

    const missingImage = await articles
      .find({ $or: [{ image: null }, { image: { $exists: false } }] })
      .toArray();
    // Pixel art is free and instant to (re)generate, so every article gets
    // refreshed here rather than only ones missing it — this is also how an
    // older, differently-styled pixelArt gets replaced.
    const allArticles = await articles.find({}).toArray();

    console.log(`${missingImage.length} article(s) missing a hero image.`);
    console.log(`${allArticles.length} article(s) will have pixel art (re)generated.`);

    for (const article of missingImage) {
      console.log(`Generating hero image: ${article.title}`);
      const image = await generateArticleImage({ title: article.title, context: article.summary });
      if (image) {
        await articles.updateOne({ _id: article._id }, { $set: { image } });
        console.log(`Saved hero image: ${article.slug}`);
      } else {
        console.log(`No image generated for: ${article.slug}`);
      }
    }

    for (const article of allArticles) {
      const pixelArt = generatePixelArt({ title: article.title, context: article.opinion });
      await articles.updateOne({ _id: article._id }, { $set: { pixelArt } });
      console.log(`Saved pixel art: ${article.slug}`);
    }
  } finally {
    await client.close();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
