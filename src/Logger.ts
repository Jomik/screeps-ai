import { getMemoryRef } from 'kernel/memory';

export abstract class Logger {
  constructor(protected readonly name: string) {}

  protected abstract log(
    message: string,
    location: LocationArg | undefined,
    level: LogLevel,
    color: string
  ): void;

  public alert(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Alert, '#ff00d0');
  }

  public error(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Error, '#e50000');
  }

  public warning(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Warn, '#f4c542');
  }

  public info(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Info, '#efefef');
  }

  public debug(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Debug, '#a6a4a6');
  }

  public verbose(message: string, location?: LocationArg) {
    this.log(message, location, LogLevel.Verbose, '#6e6770');
  }
}

enum LogLevel {
  Alert = 1,
  Error = 2,
  Warn = 3,
  Info = 4,
  Debug = 5,
  Verbose = 6,
}

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

const Separator = '<span style="color:#6e6770"> &rsaquo; </span>';
export class ScreepsLogger extends Logger {
  private static get settings(): { level: LogLevel } {
    return getMemoryRef('logger', { level: LogLevel.Warn });
  }

  public static setLogLevel(level: LogLevel) {
    this.settings.level = level;
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
    message: string,
    location: LocationArg | undefined,
    level: LogLevel,
    color: string
  ) {
    if (level > ScreepsLogger.settings.level) {
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
    output += message;
    console.log(`<span style="color:${color}">${output}</span>`);
  }
}
