"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '7d';
function signToken(userId, username) {
    const jti = crypto_1.default.randomUUID();
    const token = jsonwebtoken_1.default.sign({ sub: userId, username, jti }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const decoded = jsonwebtoken_1.default.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);
    return { token, jti, expiresAt };
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}
