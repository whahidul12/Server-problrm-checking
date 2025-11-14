const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Global Cached Connection (IMPORTANT for Vercel)
let cachedDB = null;

async function connectDB() {
    if (cachedDB) return cachedDB;

    const client = new MongoClient(process.env.MONGODB_URI, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    await client.connect();
    cachedDB = client.db("art_folio_db");

    console.log("Connected to MongoDB (cached)");
    return cachedDB;
}

// Root route
app.get("/", (req, res) => {
    res.send("App is running");
});

// Routes
app.get("/users/:email", async (req, res) => {
    const db = await connectDB();
    const arts_users = db.collection("arts_users");

    const email = req.params.email;
    const user = await arts_users.findOne({ email });

    if (!user) return res.status(404).send({ message: "User not found" });
    res.send(user);
});

app.post("/users", async (req, res) => {
    const db = await connectDB();
    const arts_users = db.collection("arts_users");

    const result = await arts_users.insertOne(req.body);
    res.send(result);
});

// Artwork routes
app.get("/artwork", async (req, res) => {
    const db = await connectDB();
    const arts_collections = db.collection("arts_collections");

    const arts = await arts_collections.find({ visibility: "Public" })
        .sort({ createdAt: -1 })
        .toArray();

    res.send(arts);
});

app.get("/artwork/limit", async (req, res) => {
    const db = await connectDB();
    const arts_collections = db.collection("arts_collections");

    const arts = await arts_collections.find({ visibility: "Public" })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();

    res.send(arts);
});

app.get("/artwork/:id", async (req, res) => {
    const db = await connectDB();
    const arts_collections = db.collection("arts_collections");

    const art = await arts_collections.findOne({ _id: new ObjectId(req.params.id) });

    if (!art) return res.status(404).send({ message: "Art not found" });
    res.send(art);
});

app.get("/artwork/user/:email", async (req, res) => {
    const db = await connectDB();
    const arts_collections = db.collection("arts_collections");

    const arts = await arts_collections
        .find({ artistEmail: req.params.email })
        .toArray();

    res.send(arts);
});

app.put("/artwork/:id", async (req, res) => {
    const db = await connectDB();
    const arts_collections = db.collection("arts_collections");

    const updatedArt = req.body;
    delete updatedArt._id; // Important

    const result = await arts_collections.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updatedArt }
    );

    res.send(result);
});

app.delete("/artwork/:id", async (req, res) => {
    const db = await connectDB();
    const arts_collections = db.collection("arts_collections");

    const result = await arts_collections.deleteOne({
        _id: new ObjectId(req.params.id)
    });

    res.send(result);
});

app.post("/add-artwork", async (req, res) => {
    const db = await connectDB();
    const arts_collections = db.collection("arts_collections");

    const new_art = {
        ...req.body,
        createdAt: new Date(),
    };

    const result = await arts_collections.insertOne(new_art);
    res.status(201).json(result);
});

// Favorites: Add
app.post("/users/:email/favorites", async (req, res) => {
    const db = await connectDB();
    const arts_users = db.collection("arts_users");

    const { artworkId } = req.body;
    const email = req.params.email;

    const result = await arts_users.updateOne(
        { email },
        { $addToSet: { user_fav_list: new ObjectId(artworkId) } }
    );

    res.send(result);
});

// Favorites: Remove
app.delete("/users/:email/favorites/:artworkId", async (req, res) => {
    const db = await connectDB();
    const arts_users = db.collection("arts_users");

    const { email, artworkId } = req.params;

    const result = await arts_users.updateOne(
        { email },
        { $pull: { user_fav_list: new ObjectId(artworkId) } }
    );

    res.send(result);
});

// Favorites: Fetch user's favorite artworks
app.get("/users/:email/favorites", async (req, res) => {
    const db = await connectDB();
    const arts_users = db.collection("arts_users");
    const arts_collections = db.collection("arts_collections");

    const user = await arts_users.findOne({ email: req.params.email });

    if (!user) return res.status(404).send({ message: "User not found" });

    const favArtworks = await arts_collections
        .find({ _id: { $in: user.user_fav_list || [] } })
        .toArray();

    res.send(favArtworks);
});

// Like/unlike artwork
app.post("/artwork/:id/like", async (req, res) => {
    const db = await connectDB();
    const arts_collections = db.collection("arts_collections");

    const { userEmail } = req.body;
    const id = req.params.id;

    const artwork = await arts_collections.findOne({ _id: new ObjectId(id) });
    if (!artwork) return res.status(404).send({ message: "Artwork not found" });

    let likes = artwork.likes || 0;
    let likedBy = artwork.likedBy || [];

    if (!likedBy.includes(userEmail)) {
        likes += 1;
        likedBy.push(userEmail);
    } else {
        likes -= 1;
        likedBy = likedBy.filter((email) => email !== userEmail);
    }

    await arts_collections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { likes, likedBy } }
    );

    res.send({ likes, likedBy });
});

// IMPORTANT FOR VERCEL
module.exports = app;
