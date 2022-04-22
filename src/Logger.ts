import { getMemoryRef } from 'kernel/memory';

export enum LogLevel {
  Alert = 1,
  Error = 2,
  Warn = 3,
  Info = 4,
  Debug = 5,
  Verbose = 6,
}

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

declare const console: { log(msg: string): void };

export abstract class Logger {
  constructor(protected readonly name: string) {}

  protected abstract log(
    message: MessageThunk,
    location: LocationArg | undefined,
    level: LogLevel,
    color: string
  ): void;

  public alert(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.Alert, '#ff00d0');
  }

  public error(message: MessageThunk, location?: LocationArg) {
    this.log(message, location, LogLevel.Error, '#e50000');
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

const Separator = '<span style="color:#6e6770"> &rsaquo; </span>';

export class ScreepsLogger extends Logger {
  private static settingsRef = getMemoryRef('logger', {
    level: LogLevel.Warn,
    filter: undefined as string | undefined,
  });
  private static get level(): LogLevel {
    return this.settingsRef.get().level;
  }

  public static setLogLevel(level: LogLevel): string | undefined {
    if (!(level in LogLevel)) {
      return 'Invalid log level';
    }
    this.settingsRef.get().level = level;
    return;
  }
  private static get filter(): string | undefined {
    return this.settingsRef.get().filter;
  }

  public static setLogFilter(filter: string | undefined): string | undefined {
    if (filter !== undefined && filter.length < 0) {
      return 'Invalid log filter';
    }
    this.settingsRef.get().filter = filter;
    return;
  }

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

  protected log(
    message: MessageThunk,
    location: LocationArg | undefined,
    level: LogLevel,
    color: string
  ) {
    if (level > ScreepsLogger.level) {
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
    const filter = ScreepsLogger.filter;
    if (filter && !output.includes(filter)) {
      return;
    }
    console.log(`<span style="color:${color}">${output}</span>`);
  }
}
