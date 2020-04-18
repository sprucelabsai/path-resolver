import { SpruceErrorOptions, ISpruceErrorOptions } from '@sprucelabs/error'

// Error codes
export enum ErrorCode {
	TsConfigNotFound = 'TS_CONFIG_NOT_FOUND',
	InvalidTsConfig = 'INVALID_TS_CONFIG',
	CouldNotFindFile = 'COULD_NOT_FIND_FILE',
	InvalidParameters = 'INVALID_PARAMETERS',
	AlreadyRunning = 'ALREADY_RUNNING'
}

// All error options
export type ErrorOptions =
	| ITsConfigNotFoundErrorOptions
	| IInvalidTsConfigErrorOptions
	| ICouldNotFindFileErrorOptions
	| IInvalidParametersErrorOptions
	| IAlreadyRunningErrorOptions
	| SpruceErrorOptions

export interface ITsConfigNotFoundErrorOptions
	extends ISpruceErrorOptions<ErrorCode> {
	/** * .TsConfigNotFound - could not find the tsconfig */
	code: ErrorCode.TsConfigNotFound
	tsLookupPaths: string[]
	cwd: string
}

export interface IInvalidTsConfigErrorOptions
	extends ISpruceErrorOptions<ErrorCode> {
	/** * .InvalidTsConfig - the tsconfig is invalid */
	code: ErrorCode.InvalidTsConfig
	tsConfigPath: string
}

export interface ICouldNotFindFileErrorOptions
	extends ISpruceErrorOptions<ErrorCode> {
	/** * .CouldNotFindFile - found a path alias match, but no actual file exists */
	code: ErrorCode.CouldNotFindFile
	request: string
	candidates: string[]
}

export interface IInvalidParametersErrorOptions
	extends ISpruceErrorOptions<ErrorCode> {
	/** * .InvalidParameters - bad options sent to the resolver */
	code: ErrorCode.InvalidParameters
}

export interface IAlreadyRunningErrorOptions
	extends ISpruceErrorOptions<ErrorCode> {
	/** * .AlreadyRunning - bad options sent to the resolver */
	code: ErrorCode.AlreadyRunning
}
