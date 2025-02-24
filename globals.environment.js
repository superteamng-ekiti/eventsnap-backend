import dotenv from "dotenv";
dotenv.config();

const env = process.env;

const PINATA_APIKey = env.PINATA_APIKey;
const PINATA_APISecret = env.PINATA_APISecret;
const PINATA_JWT = env.PINATA_JWT;
const PINATA_GATEWAY = env.PINATA_GATEWAY;

export { PINATA_APIKey, PINATA_APISecret, PINATA_JWT, PINATA_GATEWAY };
