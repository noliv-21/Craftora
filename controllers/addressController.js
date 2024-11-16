const Users = require('../models/userSchema')
const Addresses = require('../models/addressSchema')

exports.showUserAddresses = async (req,res)=>{
    try {
        const errorMessage = req.session.user.errorMess;
        console.log(errorMessage);
        const successMessage = req.session.user.successMess;
        console.log(successMessage);
        const session = req.session.user;
        const addresses = await Addresses.find({userId:session._id})
        res.render('user/dashboard/address',{
            addresses,session,activeTab:'addresses',successMessage,errorMessage
        })
    } catch (error) {
        console.error(error);
    }
}

exports.addAddress = async (req,res)=>{
    try {
        const address = req.body;
        const newAddress = new Addresses({
            name:address.name, streetAddress:address.streetAddress, city:address.city,
            state:address.state, country:address.country, pincode:address.pincode, phone:address.phone,
            userId:req.session.user._id
        })
        await newAddress.save()
        console.log("Address saved successfully");
        res.status(201).json("Address successfully created")
    } catch (error) {
        console.error(error)
        res.status(500).json("Error saving address")
    }
}

exports.deleteAddress = async (req,res)=>{
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Address ID is required.' });
        }
        const deletedAddress = await Addresses.findByIdAndDelete(id);
        if (!deletedAddress) {
            return res.status(404).json({ error: 'Address not found.' });
        }
        res.status(200).json('Address deleted successfully.' );
    } catch (error) {
        console.error("Error deleting address:", error);
        res.status(500).json('An error occurred while deleting the address.' );
    }
}

exports.editAddress = async (req,res)=>{
    try {
        const address = req.body;
        const id = req.params.addressId
        await Addresses.findByIdAndUpdate(id,{
            name:address.name, streetAddress:address.streetAddress, city:address.city,
            state:address.state, country:address.country, pincode:address.pincode, phone:address.phone,
        })
        console.log("Address edited successfully");
        res.status(200).json('Address edited successfully')
    } catch (error) {
        console.error(error)
        res.status(500).json('An error occurred while editing the address.' );
    }
}

exports.getAddressPage = async (req,res)=>{
    try {
        const userId = req.session.user._id;
        const addresses = await Addresses.find({userId})
        res.render('user/order/address',{
            addresses,activeTab:'addresses'
        })
    } catch (error) {
        console.error(error)
    }
}