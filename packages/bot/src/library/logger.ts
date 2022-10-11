import { ErrorMapper } from '../utils/ErrorMapper';
import { InvalidArgumentError, registerCommand } from './console';
import { getMemoryRef } from './memory';

declare const console: { log(message: string): void };

type MessageThunk = string | (() => string);
type LocationArg =
  | {
      room: Room;
    }
  | {
      pos: RoomPosition;
    }
  | Room
  | RoomPosition
  | string;

export enum LogLevel {
  alert = 1,
  error = 2,
  warn = 3,
  info = 4,
  debug = 5,
  verbose = 6,
}

export interface Logger {
  alert(message: MessageThunk, location?: LocationArg): void;
  error(error: Error | MessageThunk, location?: LocationArg): void;
  warn(message: MessageThunk, location?: LocationArg): void;
  info(message: MessageThunk, location?: LocationArg): void;
  debug(message: MessageThunk, location?: LocationArg): void;
  verbose(message: MessageThunk, location?: LocationArg): void;
}

export const createLogger = (name: string): Logger => new ConsoleLogger(name);

const settingsRef = getMemoryRef('logger', {
  level: LogLevel.warn,
  filter: undefined as string | undefined,
}).get();

registerCommand('setLogLevel', (level) => {
  if (typeof level === 'number') {
    settingsRef.level = level;
  }

  if (typeof level !== 'string' || !(level.toLowerCase() in LogLevel)) {
    throw new InvalidArgumentError('LogLevel', level);
  }

  settingsRef.level = LogLevel[level.toLowerCase() as keyof typeof LogLevel];
  return undefined;
});

registerCommand('setLogFilter', (filter) => {
  if (filter !== undefined && typeof filter !== 'string') {
    throw new InvalidArgumentError('string', filter);
  }

  if (filter !== undefined && filter.length < 0) {
    return 'Invalid log filter';
  }

  settingsRef.filter = filter;
  return undefined;
});

const Separator = '<span style="color:#6e6770"> &rsaquo; </span>';

class ConsoleLogger implements Logger {
  constructor(private readonly name: string) {}

  private getRoomName(room: LocationArg): string {
    if (typeof room === 'string') {
      return room;
    }

    if ('room' in room) {
      return room.room.name;
    }

    if ('pos' in room) {
      return room.pos.roomName;
    }

    if ('roomName' in room) {
      return room.roomName;
    }

    return room.name;
  }

  private log(
    message: MessageThunk,
    location: LocationArg | undefined,
    level: LogLevel,
    color: string
  ): void {
    if (level > settingsRef.level) {
      return;
    }

    let output = '';
    output += `[${Game.time}]`;
    output += Separator;
    output += this.name;
    output += Separator;

    if (location) {
      const roomName = this.getRoomName(location);
      output += `<a href="#!/room/${Game.shard.name}/${roomName}">${roomName}</a>`;
      output += Separator;
    }
    output += typeof message === 'function' ? message() : message;

    const filter = settingsRef.filter;
    if (filter && !output.includes(filter)) {
      return;
    }
    console.log(`<span style="color:${color}">${output}</span>`);
  }

  public alert(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.alert, '#ff00d0');
  }

  public error(error: Error | MessageThunk, location?: LocationArg) {
    this.log(
      error instanceof Error
        ? () => error.message + '\n' + ErrorMapper.sourceMappedStackTrace(error)
        : error,
      location,
      LogLevel.error,
      '#e50000'
    );
  }

  public warn(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.warn, '#f4c542');
  }

  public info(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.info, '#efefef');
  }

  public debug(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.debug, '#a6a4a6');
  }

  public verbose(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.verbose, '#6e6770');
  }
}
