import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import AuthRoutes from './routes/AuthRoutes.js'
import MessageRoutes from "./routes/MessageRoutes.js"
import { Server } from 'socket.io'

dotenv.config();
const port = process.env.PORT || 5000
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth",AuthRoutes)
app.use("/api/messages",MessageRoutes)


const server = app.listen(port,()=>{
    console.log(`you are listening at ${port}`)
})

const io = new Server(server, {
    cors:{
        origin:"https://whatsapw.netlify.app/",
    },
})

global.onlineUsers = new Map();
global.currentChatUser = new Map();;

io.on("connection", (socket)=>{
    global.chatShocket = socket;
    socket.on("add-user", (userId)=>{
        // console.log(userId)
        onlineUsers.set(userId, socket.id);
        // console.log(onlineUsers)
    })
    socket.on("send-msg", async (data) => {
        const sendUserSocket = await onlineUsers.get(data.recieverId);
        if (sendUserSocket) {
            console.log("dhdh")
            socket.to(sendUserSocket).emit("msg-recieve", data);
        }
        // onlineUsers.set(data.to, socket.id);
    })
    socket.on("typing", async (data) => {
        const sendUserSocket = await onlineUsers.get(data.recieverId);
        if (sendUserSocket) {
            socket.to(sendUserSocket).emit("user-typing");
        }
        // onlineUsers.set(data.to, socket.id);
    })
    
    socket.on("send-msg-read", async (data) => {
        const sendUserSocket = await onlineUsers.get(data.to);
        currentChatUser.set(data.by, data.to);
        if (sendUserSocket) {
            socket.to(sendUserSocket).emit("msg-read");
        }
        // onlineUsers.set(data.to, socket.id);
    })

    socket.on("typingblur", async (data) => {
        const sendUserSocket = await onlineUsers.get(data.recieverId);
        if (sendUserSocket) {
            socket.to(sendUserSocket).emit("user-typingblur");
        }
        // onlineUsers.set(data.to, socket.id);
    })
    socket.on("outgoing-voice-call",(data)=>{
        const sendUserSocket = onlineUsers.get(data.to);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("incoming-voice-call",{
                from:data.from,roomId:data.roomId, callType:data.callType
            })
        }

    })
    socket.on("outgoing-video-call",(data)=>{
       
        const sendUserSocket = onlineUsers.get(data.to);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("incoming-video-call",{
                from:data.from,roomId:data.roomId, callType:data.callType
            })
        }

    })

    socket.on("reject-voice-call",(data)=>{
        const sendUserSocket = onlineUsers.get(data.from);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("voice-call-rejected",{
                from:data.from,roomId:data.roomId, type:data.type
            })
        }
    })
    socket.on("reject-video-call",(data)=>{
        const sendUserSocket = onlineUsers.get(data.from);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("video-call-rejected",{
                from:data.from,roomId:data.roomId, callType:data.callType
            })
        }
    })

    socket.on("accept-incoming-call",(data)=>{
        const sendUserSocket = onlineUsers.get(data.id);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("accept-call")
            // console.log("call accepted")
        }
    })

    // socket.on("DisconnectEvent",(userId)=>{
    //     console.log("before", onlineUsers)
       
    //     console.log("after", onlineUsers)
    // })

    // socket.on('disconnecting', (userId) => {
    //     onlineUsers.delete(userId);
    //     currentChatUser.delete(userId)
    // })
})