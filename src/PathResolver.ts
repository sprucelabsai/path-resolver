import coreModuleLoader = require('module')
import path = require('path')
import fs from 'fs'
import log from './lib/log'

export interface IPathResolverOptions {
	/** Current working directory, i'll start here and work up directories until i find a tsconfig.json */
	cwd?: string
	/** Supported file extensions, defaults to everything setup in node */
	extensions?: string[]
}

/** Enable paths support from compiler options of the tsconfig */
export default class PathResolver {
	public compilerOptions: Record<string, any>
	public replacePaths: Record<string, string[]> = {}
	public pathCache: Record<string, string> = {}
	public cwd: string
	public baseDir: string
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

		// We have to set these to at least something or ts will not pass lint
		this.cwd = this.baseDir = cwd || (process && process.cwd()) || '/'
		this.compilerOptions = {}

		log.info('PathResolver setup for', this.extensions)
		let found = false
		const pathParts = this.cwd.split(path.sep)
		if (pathParts[0] === '') {
			pathParts[0] = path.sep
		}
		do {
			const dir = path.join(...pathParts)
			const tsConfigPath = path.join(dir, 'tsconfig.json')
			if (fs.existsSync(tsConfigPath)) {
				log.info(`Loading tsconfig from ${tsConfigPath}`)
				this.compilerOptions = require(tsConfigPath).compilerOptions
				this.baseDir =
					this.compilerOptions.baseUrl &&
					this.compilerOptions.baseUrl[0] === path.sep
						? this.compilerOptions.baseUrl
						: path.join(dir, this.compilerOptions.baseUrl ?? '.')
				found = true
				break
			}
			pathParts.pop()
		} while (pathParts.length > 0 && !found)

		if (!found) {
			throw new Error(
				`Could not found ts config in ${cwd} or anywhere upstream.`
			)
		}
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

					// Try relative to output dir
					if (typeof this.compilerOptions.outDir === 'string') {
						candidates.push(
							path.join(
								this.baseDir,
								this.compilerOptions.outDir,
								request.replace(regex, candidatePath)
							)
						)
					}

					// Try relative to cwd
					candidates.push(
						path.join(this.baseDir, request.replace(regex, candidatePath))
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
				`Found a match for ${request} but no candidates found: \n\n ${attemptedPaths.join(
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
