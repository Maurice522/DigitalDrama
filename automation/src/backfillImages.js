import "dotenv/config";

import { connectDb } from "./db.js";
import { generateArticleImage } from "./imageGen.js";
import { generatePixelArt } from "./pixelArt.js";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");

async function main() {
  const { client, articles } = await connectDb(MONGODB_URI);

  try {
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
