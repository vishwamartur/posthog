import { actions, kea, listeners, path, reducers } from 'kea'
import api from 'lib/api'
import { execHog } from 'lib/hog'

import type { hogReplLogicType } from './hogReplLogicType'

export interface ReplChunk {
    code: string
    result?: string
    print?: string
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
        print: (index: number, line?: string) => ({ index, line }),
        setBytecode: (index: number, bytecode: any[], locals: any[]) => ({ index, bytecode, locals }),
    }),
    reducers({
        replChunks: [
            [] as ReplChunk[],
            {
                runCode: (state, { code }) => [...state, { code, status: 'pending' } as ReplChunk],
                setResult: (state, { index, result, error }) =>
                    state.map((chunk, i) =>
                        i === index ? { ...chunk, result, error, status: error ? 'error' : 'success' } : chunk
                    ),
                setBytecode: (state, { index, bytecode, locals }) =>
                    state.map((chunk, i) => (i === index ? { ...chunk, bytecode, locals } : chunk)),
                print: (state, { index, line }) =>
                    state.map((chunk, i) =>
                        i === index ? { ...chunk, print: (chunk.print ? chunk.print + '\n' : '') + line } : chunk
                    ),
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
                const result = execHog(bytecode, {
                    functions: {
                        print: (value: any) => {
                            actions.print(index, String(value))
                        },
                    },
                })
                // Set the result
                actions.setResult(index, String(result.result))
            } catch (error: any) {
                // Handle errors
                actions.setResult(index, undefined, error.toString())
            }
        },
    })),
])
