import sharp from 'sharp';
import getPrismaInstance from "../utils/PrismaClient.js";
import { renameSync } from "fs";
import path from "path";
import fs from 'fs/promises';


export const addMessage = async (req, res, next) => {
  try {
    const prisma = getPrismaInstance();
    const { message, from, to } = req.body;
    const getUser = onlineUsers.get(to);
    var msgStatus = "sent"
    if(currentChatUser.get(to) === from){
      msgStatus = "read"
    }else if(getUser){
      msgStatus = "delivered"
    }
    if (message && from && to) {
      const newMessage = await prisma.messages.create({
        data: {
          message,
          sender: { connect: { id: from } },
          reciever: { connect: { id: to } },
          messageStatus: msgStatus,
        },
        include: { reciever: true, sender: true },
      });
      return res.status(201).send({ message: newMessage });
    }
    return res.status(400).send("From, to and message is required");
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const prisma = getPrismaInstance();
    const { from, to } = req.params;

    const message = await prisma.messages.findMany({
      where: {
        OR: [
          {
            senderId: from,
            recieverId: to,
          },
          {
            senderId: to,
            recieverId: from,
          },
        ],
      },
      include: {
        imagemessages: true, 
      },
      orderBy: {
        id: "asc",
      },
    });

    const unReadMeassages = [];
    message.forEach((message, index) => {
      if (message.messageStatus !== "read" && message.senderId === to) {
        message.messageStatus = "read";
        unReadMeassages.push(message.id);
      }
    });

    
    await prisma.messages.updateMany({
      where: { id: { in: unReadMeassages } },
      data: { messageStatus: "read" },
    });
    
    // Convert binary data to base64 for image messages
    const messagesWithBase64 = message.map((message) => {
      var msgbase = message.message;
      if(message.type==="audio"){
        msgbase = message.audiomessage.toString('base64')
      }else if(message.type==="image"){
        msgbase = msgbase = {
          msg:message.imagemessages[1].image.toString('base64'),
          originalId:message.imagemessages[0].id,
          original:false
        }
      }
      return {
        id: message.id,
        senderId: message.senderId,
        recieverId: message.recieverId,
        type: message.type,
        message: msgbase,
        messageStatus: message.messageStatus,
        createdAt: message.createdAt,
      };
    });

    res.status(200).json({ message: messagesWithBase64});
  } catch (error) {
    next(error);
  }
};

export const getImage = async(req, res) => {
  const prisma = getPrismaInstance();

  try {
    const imageMessage = await prisma.imageMessage.findUnique({
      where: { id: req.params.id },
      include: { message: true }, // Include the associated message if needed
    });

    if(imageMessage){
      return res.status(200).json({message:imageMessage.image.toString('base64'),original:true})
    }
    res.status(200).json({mesage:"image not found"})
  } catch (error) {
    console.error('Error fetching image message:', error);
    throw error;
  }
};

export const addImageMessage = async (req, res, next) => {
  try {
    const prisma = getPrismaInstance();
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).send("From and to are required");
    }

    // Read original image data as a Buffer
    const originalImageBuffer = await fs.readFile(req.file.path);

    // Resize the image to a lower resolution
    const lowerResolutionBuffer = await sharp(originalImageBuffer)
  .resize({fit: sharp.fit.inside })
  .toBuffer();

  const getUser = onlineUsers.get(to);
  var msgStatus = "sent"
  if(currentChatUser.get(to) === from){
    msgStatus = "read"
  }else if(getUser){
    msgStatus = "delivered"
  }

    // Store both original and lower-resolution image data in the database
    const message = await prisma.messages.create({
      data: {
        imagemessages: {
          create: [
            {
              image: Buffer.from(originalImageBuffer),
              resolution: 'original',
            },
            {
              image: Buffer.from(lowerResolutionBuffer),
              resolution: 'lower',
            },
          ],
        },
        sender: {
          connect: { id: from },
        },
        reciever: {
          connect: { id: to },
        },
        type: 'image',
        messageStatus: msgStatus,

      },
    });

    const imageMessage = await prisma.imageMessage.findUnique({
      where: { id: message.id },
      include: { message: true }, // Include the associated message if needed
    });

    // Remove the temporary file
    await fs.unlink(req.file.path);

    return res.status(201).json({msg:imageMessage,original:true, msgStatus: msgStatus});
  } catch (error) {
    next(error);
  }
};

export const addAudioMessage = async (req, res, next) => {
  try {

    const prisma = getPrismaInstance();
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).send("From and to are required");
    }

    const audioBuffer = await fs.readFile(req.file.path);

    const message = await prisma.messages.create({
            data: {
              audiomessage: Buffer.from(audioBuffer),
              sender: { connect: { id: from } },
              reciever: { connect: { id: to } },
              type: "audio",
            },
          });

          await fs.unlink(req.file.path);

          return res.status(201).json({ message });

  } catch (error) {
    next(error);
  }
};

export const getInitialContactSwitchMessages = async (req, res, next) => {
  try {
    const userId = req.params.from;
    const prisma = getPrismaInstance();

    // Fetch user and messages
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sentMessages: {
          include: {
            reciever: true,
            sender: true,
          },
          orderBy: {
            createdAt: "desc", // Fix the ordering field here
          },
        },
        recievedMessages: {
          include: {
            reciever: true,
            sender: true,
          },
          orderBy: {
            createdAt: "desc", // Fix the ordering field here
          },
        },
      },
    });

    await prisma.messages.updateMany({
      where: {
        id: {
          in: user.recievedMessages.map(message => message.id)
        },
        messageStatus: {
          not: "read"  // Adding condition to update only when messageStatus is not "read"
        }
      },
      data: {
        messageStatus: "delivered"
      }
    });
    

    // Combine and sort messages
    const messages = [...user.sentMessages, ...user.recievedMessages];
    messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // return res.json({messages:user.recievedMessages})

    // Create a map to track users based on their last message
    const usersMap = new Map();

    // Create a map to track unread messages by other users
    const unreadMessagesMap = new Map();

    // Process messages and populate usersMap and unreadMessagesMap
    messages.forEach((msg) => {
      const isSender = msg.senderId === userId;
      const otherUserId = isSender ? msg.recieverId : msg.senderId;

      if (!usersMap.has(otherUserId)) {
        usersMap.set(otherUserId, {
          id: otherUserId,
          lastMessage: {
            type: msg.type,
            senderId: msg.senderId,
            sender: msg.sender,
            recieverId: msg.recieverId,
            reciever: msg.reciever,
            messageStatus: msg.messageStatus,
            message: msg.message,
            id: msg.id,
            createdAt: msg.createdAt
          },
        });
      }

      if (!isSender && msg.messageStatus !== "read") {
        const unreadCount = unreadMessagesMap.get(otherUserId) || 0;
        unreadMessagesMap.set(otherUserId, unreadCount + 1);
      }
    });

    // Convert map values to an array and sort based on the last message timestamp
    const sortedUsers = Array.from(usersMap.values()).sort(
      (a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime()
    );

    // Include the unread message count for each sorted user
    const usersWithUnreadCount = sortedUsers.map((sortedUser) => ({
      ...sortedUser,
      unreadMessageCount: unreadMessagesMap.get(sortedUser.id) || 0,
    }));

    return res.status(200).json({
      users: usersWithUnreadCount,
      onlineUsers: Array.from(onlineUsers.keys()),
    });
  } catch (error) {
    next(error);
  }
};