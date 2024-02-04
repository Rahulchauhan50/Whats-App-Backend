import { Router } from "express";
import { addAudioMessage, addMessage, getImage, getInitialContactSwitchMessages, getMessages } from "../controllers/MessageController.js";
import multer from "multer";
import { addImageMessage } from "../controllers/MessageController.js";

const router = Router();

const UplaodImage = multer({dest:"uploads/images/"})
const UplaodAudio = multer({dest:"uploads/recordings/"})

router.post("/add-message",addMessage)
router.get("/get-messages/:from/:to",getMessages)
router.post("/add-image-message",UplaodImage.single('image'), addImageMessage)
router.post("/add-audio-message",UplaodAudio.single('audio'), addAudioMessage)
router.get("/get-intial-contacts/:from",getInitialContactSwitchMessages)
router.get("/get-image/:id",getImage)

export default router