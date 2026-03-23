import { Router } from "express"
import { checkUser, generateToken, getAllUsers, onBoardUser, updateProfile } from "../controllers/AuthController.js"
import multer from "multer";

const router = Router();

const UplaodImage = multer({dest:"uploads/images/"})
 
router.post('/check-user',checkUser)
router.post('/onboard-user',UplaodImage.single('image'),onBoardUser)
router.get('/get-contacts',getAllUsers)
router.post('/update-profile',UplaodImage.single('image'),updateProfile)
router.get('/generate-token/:userId',generateToken)

export default router