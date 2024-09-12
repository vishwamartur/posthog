import { actions, kea, listeners, path, reducers } from 'kea'
import api from 'lib/api'
import { execHog } from 'lib/hog'

import type { hogReplLogicType } from './hogReplLogicType'

export interface ReplChunk {
    code: string
    result?: string
    error?: string
    bytecode?: any[]
    locals?: any[]
    status: 'pending' | 'success' | 'error'
}

export const hogReplLogic = kea<hogReplLogicType>([
    path(['scenes', 'debug', 'HogRepl']),
    actions({
        runCode: (code: string) => ({ code }),
        setResult: (index: number, result?: string, error?: string) => ({ index, result, error }),
        setBytecode: (index: number, bytecode: any[], locals: any[]) => ({ index, bytecode, locals }),
    }),
    reducers({
        replChunks: [
            [] as ReplChunk[],
            {
                runCode: (state, { code }) => [...state, { code, status: 'pending' } as ReplChunk],
                setResult: (state, { index, result, error }) => {
                    const replChunks = [...state]
                    const chunk = replChunks[index]
                    if (chunk) {
                        replChunks[index] = {
                            ...chunk,
                            result,
                            error,
                            status: error ? 'error' : 'success',
                        }
                    }
                    return replChunks
                },
                setBytecode: (state, { index, bytecode, locals }) => {
                    const replChunks = [...state]
                    const chunk = replChunks[index]
                    if (chunk) {
                        replChunks[index] = {
                            ...chunk,
                            bytecode,
                            locals,
                        }
                    }
                    return replChunks
                },
            },
        ],
    }),
    listeners(({ actions, values }) => ({
        runCode: async ({ code }) => {
            const index = values.replChunks.length - 1
            try {
                const lastLocals = values.replChunks[index - 1]?.locals
                // Start compilation
                const res = await api.hog.create(code, lastLocals)
                // Execute compiled code
                const bytecode = [...res.bytecode]
                const locals = res.locals
                actions.setBytecode(index, bytecode, locals)
                // swap the last opcode from pop to return
                if (bytecode[bytecode.length - 1] === 35) {
                    bytecode[bytecode.length - 1] = 38
                }
                const result = execHog(bytecode)
                // Set the result
                actions.setResult(index, String(result.result))
            } catch (error: any) {
                // Handle errors
                actions.setResult(index, undefined, error.toString())
            }
        },
    })),
])
