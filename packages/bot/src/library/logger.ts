import { ErrorMapper } from '../utils/ErrorMapper';
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
  Alert = 1,
  Error = 2,
  Warn = 3,
  Info = 4,
  Debug = 5,
  Verbose = 6,
}

export interface Logger {
  alert(message: MessageThunk, location?: LocationArg): void;
  error(message: MessageThunk, error: Error, location?: LocationArg): void;
  warn(message: MessageThunk, location?: LocationArg): void;
  info(message: MessageThunk, location?: LocationArg): void;
  debug(message: MessageThunk, location?: LocationArg): void;
  verbose(message: MessageThunk, location?: LocationArg): void;
}

export const createLogger = (name: string): Logger => new ConsoleLogger(name);

const settingsRef = getMemoryRef('logger', {
  level: LogLevel.Warn,
  filter: undefined as string | undefined,
}).get();

export const setLogLevel = (level: LogLevel): string | undefined => {
  if (!(level in LogLevel)) {
    return 'Invalid log level';
  }
  settingsRef.level = level;
  return;
};

export const setLogFilter = (
  filter: string | undefined
): string | undefined => {
  if (filter !== undefined && filter.length < 0) {
    return 'Invalid log filter';
  }
  settingsRef.filter = filter;
  return;
};

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
    this.log(message, location, LogLevel.Alert, '#ff00d0');
  }

  public error(message: MessageThunk, error: Error, location?: LocationArg) {
    this.log(
      () =>
        (typeof message === 'function' ? message() : message) +
        '\n' +
        error.message +
        '\n' +
        ErrorMapper.sourceMappedStackTrace(error),
      location,
      LogLevel.Error,
      '#e50000'
    );
  }

  public warn(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.Warn, '#f4c542');
  }

  public info(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.Info, '#efefef');
  }

  public debug(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.Debug, '#a6a4a6');
  }

  public verbose(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.Verbose, '#6e6770');
  }
}
