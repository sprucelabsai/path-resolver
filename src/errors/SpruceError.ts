import BaseSpruceError from '@sprucelabs/error'
import { ErrorCode, ErrorOptions } from './error.types'

export default class SpruceError extends BaseSpruceError<ErrorOptions> {
	/** An easy to understand version of the errors */
	public friendlyMessage(): string {
		const { options } = this
		let message
		switch (options?.code) {
			case ErrorCode.TsConfigNotFound:
				message = `Could not find a tsconfig, checked: \n\n ${options.tsLookupPaths.join(
					'\n'
				)}`
				break
			case ErrorCode.InvalidTsConfig:
				message = `Invalid the tsconfig.json (${options.tsConfigPath})`
				break
			case ErrorCode.AlreadyRunning:
				message =
					'You can only have 1 PathParser running at a time. You can instantiate a new PathParser with {enable:false} if you wish.'
				break
			case ErrorCode.CouldNotFindFile:
				message = `Could not find ${
					options.request
				}. Tried: \n\n${options.candidates.join('\n')}`
				break
			default:
				message = super.friendlyMessage()
		}

		// Add on friendlyMessage if one exists
		message + options.friendlyMessage ? `\n\n${options.friendlyMessage}` : ''

		return message
	}
}
