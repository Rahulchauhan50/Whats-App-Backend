import { Router } from "express"
import { checkUser, generateToken, getAllUsers, getSavedGoogleContacts, importGoogleContacts, onBoardUser, updateProfile } from "../controllers/AuthController.js"
import multer from "multer";

const router = Router();

const UplaodImage = multer({dest:"uploads/images/"})
 
router.post('/check-user',checkUser)
router.post('/onboard-user',UplaodImage.single('image'),onBoardUser)
router.get('/get-contacts',getAllUsers)
router.post('/import-google-contacts',importGoogleContacts)
router.get('/get-google-contacts/:userId',getSavedGoogleContacts)
router.post('/update-profile',UplaodImage.single('image'),updateProfile)
router.get('/generate-token/:userId',generateToken)

export default router