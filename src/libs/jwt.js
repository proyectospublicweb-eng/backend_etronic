// Funciones para creación del Token
import jwt from "jsonwebtoken";
import { KEY_SECRET, sessionTtlMs } from "../config.js";

export function createAccessToken(payload, ttlMs = sessionTtlMs) {
  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      KEY_SECRET,
      {
        expiresIn: Math.floor(ttlMs / 1000),
      },
      (err, token) => {
        if (err) reject(err);
        resolve(token);
      }
    );
  });
}
