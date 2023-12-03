const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const socketIO = require("socket.io");
const OpenAI = require("openai");
const cors = require("cors");
const path = require('path')
require('dotenv').config()
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// EJS setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));
   console.log(process.env.OpenAIKey);
app.get("/", (req, res) => {
  res.render("index");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
const openai = new OpenAI({
  apiKey: process.env.OpenAIKey // Replace with your OpenAI API key or use process.env.OPENAI_API_KEY
});
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("joinRoom", (uuid) => {
    // Join a room identified by the UUID
    socket.join(uuid);
    console.log(`User joined room: ${uuid}`);
  });

  socket.on("userInput", async ({ uuid, userInput }) => {
    const responseChunks = [];

    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: userInput }],
        stream: true,
      });

      for await (const chunk of stream) {
        const responseChunk = chunk.choices[0]?.delta?.content || "";
        responseChunks.push(responseChunk);

        // Emit each response chunk to the specific room identified by the UUID
        io.to(uuid).emit("responseChunk", responseChunk);
      }

      // Once the response is complete, emit the entire array to the user
      io.to(uuid).emit("responseChunksComplete", responseChunks);
    } catch (error) {
      console.error(error);
      // Emit the error to the specific room identified by the UUID
      io.to(uuid).emit("error", "Internal Server Error");
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
