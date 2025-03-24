require("dotenv").config({ path: "../.env" });

const moment = require("moment-timezone");

const { OpenAI } = require("openai");
const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: apiKey });
openai.apiKey = apiKey;

const { initializeApp } = require("firebase-admin/app");
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const functions = require("firebase-functions");

initializeApp();

exports.addUser = onRequest(async (req, res) => {
    try {
        const body = req.body;

        console.log(`Body :\n${JSON.stringify(body, null, 4)}`);

        const userId = req.body.id;
        const json = {
            name: req.body.name
        };

        await getFirestore().collection("users").doc(userId)
            .set(json)
            .then(r => {
                res.status(200).send("Success");
            })
            .catch(error => {
                res.status(500).send("Failre: " + error);
            });
    } catch (error) {
        res.send(`Request failre. Error :\n${error}`);
    }
});

let messages = [
    { role: "system", content: "You are a user's friend." },
]

exports.sendMessage = onRequest(async (req, res) => {
    try {
        console.log(`Request body :\n${JSON.stringify(req.body, null, 4)}`);

        const userMessage = {
            role: "user",
            content: req.body.content,
            timestamp: FieldValue.serverTimestamp(),
        };

        const roomRef = getFirestore().collection("chatRooms").doc(req.body.chat_room_id);
        const messagesRef = roomRef.collection("messages");

        const snapshot = await messagesRef.get();
        if (snapshot.empty) {
            await messagesRef.add(
                {
                    role: "system",
                    content: "너는 사용자의 친한 친구야. 친구처럼 대해줘."
                }
            );
        }

        const newMessageRef = await messagesRef.add(userMessage);

        const doc = await newMessageRef.get();
        const date = doc.data().timestamp.toDate();

        const response = {
            timestamp: date
        };

        console.log(`Response body :\n${JSON.stringify(response, null, 4)}`);

        res.status(200).send({
            code: "200",
            message: "success.",
            request: req.body,
            response: response
        });
    } catch (error) {
        res.status(500).send({
            code: "500",
            message: `failre: ${error}`,
            request: req.body,
            response: null
        });
    }
});

exports.getMessageFromAI = onRequest(async (req, res) => {
    try {
        console.log(`Request body :\n${JSON.stringify(req.body, null, 4)}`);

        const roomRef = getFirestore().collection("chatRooms").doc(req.body.chat_room_id);
        const messagesRef = roomRef.collection("messages");

        const allMessages = [];
        const snapshot = await messagesRef.get();

        snapshot.forEach(doc => {
            allMessages.push({
                role: doc.data().role,
                content: doc.data().content,
                timestamp: doc.data().timestamp,
            });
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: allMessages,
            store: true,
        });

        const assistantMessage = completion.choices[0].message;
        const message = {
            role: assistantMessage.role,
            content: assistantMessage.content,
            timestamp: FieldValue.serverTimestamp(),
        };

        const newMessageRef = await messagesRef.add(message);

        const doc = await newMessageRef.get();
        const date = doc.createTime.toDate();

        console.log(`Choices :\n${JSON.stringify(completion.choices[0], null, 4)}`);
        console.log(`Usage :\n${JSON.stringify(completion.usage, null, 4)}`);

        const response = {
            role: "assistant",
            // content: "Hello from server.",
            content: doc.data().content,
            name: "assistant",
            // timestamp: "2025-03-24T01:19:02.578Z"
            timestamp: date
        }

        console.log(`Response body :\n${JSON.stringify(response, null, 4)}`);

        res.status(200).send({
            code: "200",
            message: "success.",
            request: req.body,
            response: response
        });
    } catch (error) {
        res.status(500).send({
            code: "500",
            message: `failre: ${error}`,
            request: req.body,
            response: {}
        });
    }
});

exports.helloWorld = functions.https.onRequest((req, res) => {
    res.send("Hello from Firebase!");
});

// async function addMessage(roomId, message) {
//     let roomRef = getFirestore().collection("chatRooms").doc(roomId);
//     let messagesRef = roomRef.collection("messages");
//     let messageRef = await messagesRef.add(message);

//     return messageRef;
// }

// async function getTimestamp(messageRef) {
//     let doc = await messageRef.get();
//     let date = doc.data().timestamp.toDate();
//     let formattedDate = moment(date)
//         .tz("Asia/Seoul")
//         .format("HH:mm");

//     return formattedDate;
// }
