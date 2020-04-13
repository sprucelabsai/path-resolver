import coreModuleLoader = require('module')
import path = require('path')
import fs from 'fs'
import log from './lib/log'

export interface IPathResolverOptions {
	/** Where are we currently? tsconfig.compilerOptions.baseUrl is joined to cwd */
	cwd: string
	/** Supported file extensions, defaults to everything setup in node */
	extensions: string[]
}

/** Enable paths support from compiler options of the tsconfig */
export default class PathResolver {
	public compilerOptions: Record<string, any>
	public replacePaths: Record<string, string[]> = {}
	public pathCache: Record<string, string> = {}
	public cwd: string
	public extensions: string[] = []

	public constructor(options: IPathResolverOptions) {
		const {
			cwd,
			// @ts-ignore
			extensions = Object.keys(coreModuleLoader._extensions)
		} = options

		// Save options needed often
		this.extensions = extensions

		// Easy to mess this up
		if (this.extensions.find(ext => ext.search('.') !== 0)) {
			throw new Error('Your extensions must start with a dot')
		}

		log.info('PathResolver setup for', this.extensions)

		log.info(`Loading tsconfig from ${cwd}/tsconfig.json`)
		this.compilerOptions = require(`${cwd}/tsconfig.json`).compilerOptions

		// Set to base url
		this.cwd =
			this.compilerOptions.baseUrl &&
			this.compilerOptions.baseUrl[0] === path.sep
				? this.compilerOptions.baseUrl
				: path.join(cwd, this.compilerOptions.baseUrl ?? '.')

		log.info('Setting cwd to', cwd)

		// Setup all replace paths based on compiler options
		Object.keys(this.compilerOptions.paths).forEach(alias => {
			this.replacePaths[
				alias.replace(/\*.?/, '(.*)')
			] = this.compilerOptions.paths[alias].map((destination: string) =>
				destination.replace(/\*.?/, '$1')
			)
		})

		log.info('Paths set as', this.replacePaths)

		// Store original resolveFilename from core module loader to be called after the we do the mapping below
		//@ts-ignore
		coreModuleLoader._originalResolveFilename =
			//@ts-ignore
			coreModuleLoader._resolveFilename

		// Override _resolveFilename to do our mapping based on tsconfig
		//@ts-ignore
		coreModuleLoader._resolveFilename = (
			request: string,
			parent: coreModuleLoader,
			isMain: boolean
		) => {
			const resolved = this.resolvePath(request)
			// @ts-ignore
			return coreModuleLoader._originalResolveFilename(resolved, parent, isMain)
		}
	}

	/** Pass a path and i'll lookup places to find it based on your tsconfig */
	public resolvePath(request: string): string {
		// If already found, return now
		if (this.pathCache[request]) {
			return this.pathCache[request]
		}

		let foundMatch = false
		const attemptedPaths: string[] = []
		const pathPatterns = Object.keys(this.replacePaths)
		for (const pattern of pathPatterns) {
			// Does the requested match our patterns?
			const regex = new RegExp(pattern)
			if (request.match(regex)) {
				// Check each path to find one that exists
				for (const candidatePath of this.replacePaths[pattern]) {
					const candidates = []

					// Try relative to cwd
					candidates.push(
						path.join(this.cwd, request.replace(regex, candidatePath))
					)

					// Try relative to output dir
					candidates.push(
						path.join(
							this.cwd,
							this.compilerOptions.outDir,
							request.replace(regex, candidatePath)
						)
					)

					// Does this candidate exist? if so, mutate the request so core loads it correctly
					foundMatch = true

					// Attempt all candidates against all file extensions
					for (const candidate of candidates) {
						for (const ext of this.extensions) {
							const fullPath = candidate + ext
							attemptedPaths.push(fullPath)
							if (fs.existsSync(fullPath)) {
								log.info(`${request} mapped to -> ${fullPath}`)
								this.pathCache[request] = fullPath
								return fullPath
							}
						}
					}
				}
			}
		}

		// If we found a match on paths, but the file did not exist
		if (foundMatch) {
			log.crit(
				`Found a match for ${request} but no existing candidate: ${attemptedPaths.join(
					'\n'
				)}`
			)
			throw new Error(
				`Could not resolve ${request}, tried: \n\n ${attemptedPaths.join('\n')}`
			)
		}

		// It did not match any of our patterns, so pass it back as is
		this.pathCache[request] = request

		return request
	}
}
