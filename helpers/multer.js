const multer=require('multer')
const path= require('path')

const storage=multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,path.join(__dirname,'../public/uploads/re-image'))
    },
    filename:(req,file,cb)=>{
        cb(null,Date.now()+'-'+file.originalname)
    },
    // limits: {
    //     fileSize: 5 * 1024 * 1024, // Limit each file to 5 MB
    //     files: 5, // Allow up to 5 files to be uploaded at once
    //     fields: 30, // Maximum number of non-file fields, adjust as needed
    // }
})

// // Create multer upload middleware with limits
// const upload = multer({
//     storage: storage,
//     limits: {
//         fileSize: 5 * 1024 * 1024, // Limit each file to 5 MB
//         files: 5, // Allow up to 5 files to be uploaded at once
//         fields: 30, // Maximum number of non-file fields
//     }
// }).array('images', 5); // Adjust the field name

module.exports = storage;

// module.exports=storage;