/******************
 * Offline player is for special screens, like the error
 * screen or the Flex Fallback screen.
 *
 * This module has to follow the program-player contract.
 * Asynchronous call to return a stream. Then the stream
 * can be used to play the program.
 **/
import EventEmitter from 'events';
import { isError } from 'lodash-es';
import { Readable, Writable } from 'stream';
import { FFMPEG, FfmpegEvents } from '../ffmpeg/ffmpeg.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { Maybe } from '../types/util.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { Player, PlayerContext } from './Player.js';
import { makeLocalUrl } from '../util/serverUtil.js';

export class OfflinePlayer extends Player {
  private logger = LoggerFactory.child({ caller: import.meta });
  private context: PlayerContext;
  private error: boolean;
  private ffmpeg: FFMPEG;

  constructor(error: boolean, context: PlayerContext) {
    super();
    this.context = context;
    this.error = error;
    if (context.isLoading === true) {
      context.channel = {
        ...context.channel,
        offlinePicture: makeLocalUrl('/images/loading-screen.png'),
        offlineSoundtrack: undefined,
      };
    }
    this.ffmpeg = new FFMPEG(context.ffmpegSettings, context.channel);
    this.ffmpeg.setAudioOnly(this.context.audioOnly);
  }

  cleanUp() {
    super.cleanUp();
    this.ffmpeg.kill();
  }

  play(outStream: Writable): Promise<Maybe<TypedEventEmitter<FfmpegEvents>>> {
    try {
      const emitter = new EventEmitter() as TypedEventEmitter<FfmpegEvents>;
      let ffmpeg = this.ffmpeg;
      const lineupItem = this.context.lineupItem;
      const duration = lineupItem.streamDuration ?? 0 - (lineupItem.start ?? 0);

      let ff: Maybe<Readable>;
      if (this.error) {
        ff = ffmpeg.spawnError('Error', undefined, duration);
      } else {
        ff = ffmpeg.spawnOffline(duration);
      }

      ff?.pipe(outStream, { end: false });

      ffmpeg.on('end', () => {
        this.logger.trace('offline player end');
        emitter.emit('end');
      });

      ffmpeg.on('close', () => {
        this.logger.trace('offline player close');
        emitter.emit('close');
      });

      ffmpeg.on('error', (err) => {
        this.logger.error('offline player error: %O', err);

        //wish this code wasn't repeated.
        if (!this.error) {
          this.logger.debug('Replacing failed stream with error stream');
          ff?.unpipe(outStream);
          // ffmpeg.removeAllListeners('data'); Type inference says this is never actually used...
          ffmpeg.removeAllListeners('end');
          ffmpeg.removeAllListeners('error');
          ffmpeg.removeAllListeners('close');
          ffmpeg = new FFMPEG(
            this.context.ffmpegSettings,
            this.context.channel,
          ); // Set the transcoder options
          ffmpeg.setAudioOnly(this.context.audioOnly);
          ffmpeg.on('close', () => {
            emitter.emit('close');
          });
          ffmpeg.on('end', () => {
            emitter.emit('end');
          });
          ffmpeg.on('error', (err) => {
            this.logger.error('Emitting error ... %O', err);
            emitter.emit('error', err);
          });

          ff = ffmpeg.spawnError('oops', 'oops', Math.min(duration, 60000));

          ff?.pipe(outStream);
        } else {
          emitter.emit('error', err);
        }
      });
      return Promise.resolve(emitter);
    } catch (err) {
      if (isError(err)) {
        throw err;
      } else {
        throw Error(
          'Error when attempting to play offline screen: ' +
            JSON.stringify(err),
        );
      }
    }
  }
}
