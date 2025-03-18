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
        let body = req.body;

        console.log(`Body :\n${JSON.stringify(body, null, 4)}`);

        let userId = req.body.id;
        let json = {
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
        console.log(`Body :\n${JSON.stringify(req.body, null, 4)}`);

        let userMessage = {
            role: "user",
            content: req.body.content,
            timestamp: FieldValue.serverTimestamp(),
        };

        let roomRef = getFirestore().collection("chatRooms").doc(req.body.chat_room_id);
        let messagesRef = roomRef.collection("messages");
        let newMessageRef = await messagesRef.add(userMessage);

        let doc = await newMessageRef.get();
        let date = doc.data().timestamp.toDate();
        let formattedDate = moment(date)
            .tz("Asia/Seoul")
            .format("HH:mm");

        messages.push(userMessage);

        let response = {
            timestamp: date,
            formattedTimestamp: formattedDate
        };

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
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            store: true,
        });

        let assistantMessage = completion.choices[0].message;
        messages.push(assistantMessage);

        assistantMessageRef = await messagesRef.add(assistantMessage);
        let assistantDoc = await assistantMessageRef.get();

        console.log(`Choices :\n${JSON.stringify(completion.choices[0], null, 4)}`);
        console.log(`Usage :\n${JSON.stringify(completion.usage, null, 4)}`);

        let response = {
            role: "assistant",
            content: assistantDoc.data().content,
            timestamp: date,
            formattedTimestamp: formattedDate
        }

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
