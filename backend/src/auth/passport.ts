import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';
import { config } from '../config';

export const setupPassport = () => {
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: config.jwtSecret,
      },
      async (payload, done) => {
        try {
          const userResult = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.userId))
            .limit(1);

          if (userResult.length === 0) {
            return done(null, false);
          }

          const user = userResult[0];
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );
};
