const multer=require('multer')
const path= require('path')

const storage=multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,path.join(__dirname,'../public/uploads/re-image'))
    },
    filename:(req,file,cb)=>{
        cb(null,Date.now()+'-'+file.originalname)
    }
})

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit each file to 5 MB
        files: 10, // Allow up to 10 files to be uploaded at once
        fields: 30, // Allow a maximum of 30 non-file fields
    }
});

module.exports = upload;