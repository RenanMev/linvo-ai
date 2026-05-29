import { Inject, Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("base64url");
    const derived = (await scrypt(`${password}${this.config.PASSWORD_PEPPER}`, salt, 64)) as Buffer;

    return `scrypt:${salt}:${derived.toString("base64url")}`;
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, salt, hash] = storedHash.split(":");

    if (algorithm !== "scrypt" || !salt || !hash) {
      return false;
    }

    const derived = (await scrypt(`${password}${this.config.PASSWORD_PEPPER}`, salt, 64)) as Buffer;
    const expected = Buffer.from(hash, "base64url");

    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }
}
