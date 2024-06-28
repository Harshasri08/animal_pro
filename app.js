require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const axios = require("axios");
const bcrypt = require("bcrypt");

const app = express();

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const API_NINJAS_KEY = "KzAmgQNMVqndjKWiL7Dkag==ZehJ2IvVKMMSEY1c";

app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", async (req, res) => {
  const { username, email, phone, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.render("signup", { error: "Passwords do not match" });
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.render("signup", { error: "Phone number must be exactly 10 digits" });
  }

  try {
    const userExists = await db.collection("users").where("email", "==", email).get();
    if (!userExists.empty) {
      return res.render("signup", { error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection("users").add({
      username,
      email,
      phone,
      password: hashedPassword,
    });

    res.redirect("/login");
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userSnapshot = await db.collection("users").where("email", "==", email).get();
    if (userSnapshot.empty) {
      return res.render("login", { error: "Invalid email or password" });
    }

    const user = userSnapshot.docs[0].data();
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      res.redirect(`/dashboard?username=${user.username}`);
    } else {
      res.render("login", { error: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

app.get("/dashboard", (req, res) => {
  const { username } = req.query;
  res.render("dashboard", { username, animalData: null, error: null });
});

app.post("/search", async (req, res) => {
  const { animalName } = req.body;
  const { username } = req.query;

  try {
    const response = await axios.get(`https://api.api-ninjas.com/v1/animals?name=${animalName}`, {
      headers: {
        "X-Api-Key": API_NINJAS_KEY,
      }
    });

    if (response.data && response.data.length > 0) {
      const animalData = response.data[0];
      res.render("dashboard", {
        username,
        animalData: {
          name: animalData.name,
          scientific_name: animalData.taxonomy.scientific_name,
        },
        error: null
      });
    } else {
      res.render("dashboard", {
        username,
        animalData: null,
        error: "Animal Name is not found please check the spelling."
      });
    }
  } catch (error) {
    console.error("Error fetching animal data:", error.response ? error.response.data : error.message);
    res.render("dashboard", {
      username,
      animalData: null,
      error: "Error fetching animal data. Please try again later."
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
