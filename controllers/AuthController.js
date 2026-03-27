import getPrismaInstance from "../utils/PrismaClient.js";
import { generateToken04 } from "../utils/TokenGenerator.js"
import fs from 'fs/promises';
import path from "path";
import sharp from 'sharp';
import { renameSync } from "fs";

export const checkUser = async(req,res,next) => {
    try {
        const {email} = req.body;
        if(!email){
            return res.json({msg:"Email is require", status:false})
        }
        const prisma = getPrismaInstance();
        const user = await prisma.user.findUnique({where:{ email }})
        if(!user){
            res.json({msg:"user not found",status:false})
        }else{
         
            res.json({msg:"user found",status:true,data:user})
        }
    } catch (error) {
        next(error);
    }
} 

export const onBoardUser = async (req, res, next) => {
    try {
        const { email, name, about, image: profileImage } = req.query;
        if (!email || !name || !about) {
            return res.send("Email, name, about, and profileImage are required.");
            
        }
        const prisma = getPrismaInstance();
        if(req.file){
            const date = Date.now();
            let filename = "uploads/images/" + date + req.file.originalname;
            let fileUrl = process.env.HOST + "/" + filename
    
            renameSync(req.file.path, filename);
            await prisma.user.create({
                data: {email, name, about, profileImage, status:"true", NewUser:false,profileImage:fileUrl},
            });
        }else{
            await prisma.user.create({
                data: {email, name, about, profileImage, status:"true", NewUser:false,profileImage},
            });
        }
       
        return res.json({ msg: "Success", status: true });
    } catch (error) {
        next(error);
    }
};

export const getAllUsers = async (req, res, next) => {
    try {
        const prisma = getPrismaInstance();
        const users = await prisma.user.findMany({
            orderBy:{name:"asc"},
            select:{
                id:true,
                email:true,
                name:true,
                profileImage:true,
                about:true,
            }
        });
        const usersGroupedByInitialLetter = {};

        users.forEach(user => {
            const initialLetter = user.name.charAt(0).toUpperCase();
            if(!usersGroupedByInitialLetter[initialLetter]){
                usersGroupedByInitialLetter[initialLetter] = [];
            }
            usersGroupedByInitialLetter[initialLetter].push(user);
        });
        return res.status(200).send({users:usersGroupedByInitialLetter})
    } catch (error) {
        next(error)
    }
}

export const updateProfile = async (req, res, next) => {
    try {
        const { userId, name, about, removeProfileImage } = req.body;
        if (!userId) {
            return res.json({ msg: "User ID is required", status: false });
        }

        const prisma = getPrismaInstance();
        const updateData = {};

        if (name && name.trim().length >= 3) {
            updateData.name = name.trim();
        }
        if (about !== undefined) {
            updateData.about = about.trim();
        }
        if (removeProfileImage === "true") {
            updateData.profileImage = "/default_avatar.png";
        }
        if (req.file) {
            const date = Date.now();
            let filename = "uploads/images/" + date + req.file.originalname;
            let fileUrl = process.env.HOST + "/" + filename;
            renameSync(req.file.path, filename);
            updateData.profileImage = fileUrl;
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        return res.json({
            msg: "Profile updated",
            status: true,
            data: {
                name: updatedUser.name,
                about: updatedUser.about,
                profileImage: updatedUser.profileImage,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const importGoogleContacts = async (req, res, next) => {
    try {
        const { accessToken, userId } = req.body;
        if (!accessToken || !userId) {
            return res.json({ msg: "Access token and userId are required", status: false });
        }

        const allGoogleContacts = [];

        // Helper to fetch paginated results
        const fetchAllPages = async (baseUrl) => {
            let nextPageToken = "";
            do {
                const url = nextPageToken
                    ? `${baseUrl}&pageToken=${nextPageToken}`
                    : baseUrl;
                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!response.ok) break;
                const data = await response.json();
                const contacts = data.connections || data.otherContacts || [];
                contacts.forEach(person => {
                    if (person.emailAddresses && person.emailAddresses.length > 0) {
                        allGoogleContacts.push({
                            email: person.emailAddresses[0].value.toLowerCase(),
                            name: person.names?.[0]?.displayName || person.emailAddresses[0].value,
                        });
                    }
                });
                nextPageToken = data.nextPageToken || "";
            } while (nextPageToken);
        };

        // Fetch from main contacts (myContacts)
        await fetchAllPages(
            "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=1000&sortOrder=FIRST_NAME_ASCENDING"
        );

        // Fetch from "Other contacts"
        await fetchAllPages(
            "https://people.googleapis.com/v1/otherContacts?readMask=names,emailAddresses&pageSize=1000"
        );

        // Deduplicate by email
        const uniqueEmails = [...new Set(allGoogleContacts.map(c => c.email))];

        // Save imported emails to the user's record
        const prisma = getPrismaInstance();
        await prisma.user.update({
            where: { id: userId },
            data: { googleContactEmails: uniqueEmails },
        });

        // Find matching registered users in the app
        const matchedUsers = await prisma.user.findMany({
            where: {
                email: { in: uniqueEmails },
            },
            select: {
                id: true,
                email: true,
                name: true,
                profileImage: true,
                about: true,
            },
        });

        // Group matched users by initial letter
        const usersGroupedByInitialLetter = {};
        matchedUsers.forEach(user => {
            const initialLetter = user.name.charAt(0).toUpperCase();
            if (!usersGroupedByInitialLetter[initialLetter]) {
                usersGroupedByInitialLetter[initialLetter] = [];
            }
            usersGroupedByInitialLetter[initialLetter].push(user);
        });

        return res.status(200).json({
            status: true,
            users: usersGroupedByInitialLetter,
            totalGoogleContacts: uniqueEmails.length,
            matchedCount: matchedUsers.length,
        });
    } catch (error) {
        next(error);
    }
};

export const getSavedGoogleContacts = async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.json({ msg: "userId is required", status: false });
        }

        const prisma = getPrismaInstance();
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { googleContactEmails: true },
        });

        if (!user || !user.googleContactEmails || user.googleContactEmails.length === 0) {
            return res.json({ status: false, msg: "No saved Google contacts" });
        }

        // Find matching registered users
        const matchedUsers = await prisma.user.findMany({
            where: {
                email: { in: user.googleContactEmails },
            },
            select: {
                id: true,
                email: true,
                name: true,
                profileImage: true,
                about: true,
            },
        });

        const usersGroupedByInitialLetter = {};
        matchedUsers.forEach(u => {
            const initialLetter = u.name.charAt(0).toUpperCase();
            if (!usersGroupedByInitialLetter[initialLetter]) {
                usersGroupedByInitialLetter[initialLetter] = [];
            }
            usersGroupedByInitialLetter[initialLetter].push(u);
        });

        return res.status(200).json({
            status: true,
            users: usersGroupedByInitialLetter,
            totalGoogleContacts: user.googleContactEmails.length,
            matchedCount: matchedUsers.length,
        });
    } catch (error) {
        next(error);
    }
};

export const generateToken = (req, res, next) => {
    try {
        const appid = parseInt(process.env.NEXT_PUBLIC_ZEGO_APP_ID);
        const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_ID
        const userId = req.params.userId
        const efectiveTime = 3600;
        const payload = ""
        if (appid && serverSecret && userId) {
            const token = generateToken04(appid, userId, serverSecret, efectiveTime, payload)
            return res.status(200).json({ token })
        }
        return res.status(400).json({ appid, serverSecret, userId, payload, efectiveTime })
        
    } catch (error) {
        next(error)
    }

}