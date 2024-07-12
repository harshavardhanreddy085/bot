import mongoose from "mongoose";


const UserSchema = mongoose.Schema({
    tgId:{
        type: String,
        required: true,
        Unique: true,
    },
    firstName:{
        type: String,
        required: true
    },
    isBot: {
        type: Boolean,
        required: true,
    },
    Username:{
        type: String,
        required: true,
        Unique: true,
    },
    promptTokens:{
        type: Number,
        required: false,
    },
    completionTokens:{
        type: Number,
        required: false,
    }
},
{timestamps:true}
);

export default mongoose.model('User',UserSchema)