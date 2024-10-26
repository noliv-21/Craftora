const passport=require('passport')
const GoogleStrategy=require('passport-google-oauth20').Strategy;
const User=require('../models/userSchema.js');
const env=require('dotenv').config()

//google auth by passport
passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:'http://localhost:3010/auth/google/callback'
},
async (AccessToken,refreshToken,profile,done)=>{
    try {
        let user=await User.findOne({googleId:profile.id})
        if(user){
            return done(null,{user,isNewUser:false});
        }else{
            user=new User({
                name:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id,
            })
            await user.save()
            return done(null,{user,isNewUser:true})
        }
    } catch (error) {
        return done(error,null)
    }
}
));

passport.serializeUser((userObj,done)=>{
    done(null,userObj.user.id)
});

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err=>{
        done(err,null)
    })
})



module.exports=passport