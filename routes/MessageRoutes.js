import { Router } from "express";
import { addAudioMessage, addCallMessage, addMessage, getCallLogs, getImage, getInitialContactSwitchMessages, getMessages, addDocumentMessage } from "../controllers/MessageController.js";
import multer from "multer";
import { addImageMessage } from "../controllers/MessageController.js";

const router = Router();

const UplaodImage = multer({dest:"uploads/images/"})
const UplaodAudio = multer({dest:"uploads/recordings/"})
const UplaodDocument = multer({dest:"uploads/documents/"})

router.post("/add-message",addMessage)
router.get("/get-messages/:from/:to",getMessages)
router.post("/add-image-message",UplaodImage.single('image'), addImageMessage)
router.post("/add-audio-message",UplaodAudio.single('audio'), addAudioMessage)
router.post("/add-document-message",UplaodDocument.single('document'), addDocumentMessage)
router.post("/add-call-message",addCallMessage)
router.get("/get-call-logs/:userId",getCallLogs)
router.get("/get-intial-contacts/:from",getInitialContactSwitchMessages)
router.get("/get-image/:id",getImage)

export default router