import axios from "axios";

export default axios.create({
    baseURL: process.env.NEXT_PUBLIC_API || '/api/v1',
    withCredentials: true
});