import User from "../models/User.js"

const userService = {
  getAllUsers: async () => {
    return await User.find();
  },
  getUserById: async (id) => {
    return await User.findById(id); 
  },
  getByUsername: async (name) => {
    return await User.findOne({ name: name });
  },
  create: async(name, email, password) => {
    return await User.create({
      name: name,
      email: email,
      password: password
    })
  }
}

export default userService