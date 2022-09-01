#!/usr/bin/env node

import fs from 'fs';
import rl from 'readline'; 
const readline = rl.createInterface({
    input: process.stdin,
    output: process.stdout
});

let argv = process.argv
argv = argv.slice(argv.indexOf(process.cwd())+1);

let fl: string = fs.readFileSync(argv[0], "utf8")

let macros: {name: string, value: string}[] = []
let sections: {name: string, line: number}[] = []

fl.match(/\.\w+ ?.*/gm)?.forEach((match: string) => {
    if (match.startsWith('.define')) {
        let t = match.split(" ")
        macros.push({name: t[1], value: t[2]})
        fl = fl.replace(match, "");
    } else if (match.startsWith('.section')) {
        let t = match.split(" ")
        let p = fl.replace(/\-\-[^\n]*\n/g, "").replace(/[\r\n]/g, "").split(";")
        sections.push({name: t[1], line: p.indexOf(p.find((s: string) => s.startsWith(match)) ?? "") + (sections.length !== 0 ? 1 : 0)})
        if (sections.length === 1)
        fl = fl.replace(match, "");
        else fl = fl.replace(match, "end;");
    }
})

let file: string[] = fl.replace(/\-\-[^\n]*\n/g, "").replace(/[\n\r]/g, "").split(";")

let variables: {name: string, value: string | number}[] = []

function splitTok(val: string) {
    val = val.replace(/^\s+|\s+$/g, '');
    let instring = false;
    let escaped = false;
    let tok = ""
    let out: string[] = []
    for (let i = 0; i < val.length; i++) {
        let char = val[i];
        if (char === ' ' && !instring) {
            if (macros.map(mac => mac.name).includes(tok))  {
                out.push(macros.find(mac => mac.name === tok)?.value ?? "")
            } else {

                out.push(tok)
            }
            
            tok = ""
        } else if (char === '\\' && !escaped) {
            escaped = true;
        } else if (escaped) {
            if (char === 'n') tok += '\n'
            else if (char === 'r') tok += '\r'
            else if (char === 't') tok += '\t'
            else tok += char;
            escaped = false
        } else if (char === '"') {
            instring = !instring;
            tok += char;
        } else {
            tok += char;
        }
    }
    if (macros.map(mac => mac.name).includes(tok))  {
        out.push(macros.find(mac => mac.name === tok)?.value ?? "")
    } else {
        out.push(tok)
    }

    return out;
}

function parseType(val: string) {
    if (typeof(val) === 'string' && isNum(val)) {
        return parseFloat(val)
    } else if (val.startsWith('"') && val.endsWith('"')) {
        return val.slice(1, -1);
    } else if (variables.map(v => v.name).includes(val)) {
        return variables.find(e => e.name === val)?.value ?? "";
    } else {
        return "";
    }
}
/**
 * isNum?
 * @param {string} val 
 */
function isNum(val: string) {
    for (var i = 0; i < val.length; i++) {
        if (['0','1','2','3','4','5','6','7','8','9', '-', '.'].includes(val.charAt(0))) {

        } else {
            return false;
        }
    }
    return true;
}

function readLineSync(m: string): Promise<string> {
    return new Promise(resolve => {
        readline.question(m, (ans) => {
            resolve(ans)
        })
    });
}

function throwError(msg: string) {
    console.log(`\x1b[31m${msg}\x1b[0m`)
    process.exit(1);   
}

type Types = "string" | "number" | "variable" | "variable_name" | "any"

function checkSyntax(inp: (string)[], syntax: Types[], line: number) {
    if (inp.length < syntax.length+1) {
        throwError(`On instruction "${inp.join(" ")}":\n\tinptruction "${inp[0]}" requires ${syntax.length} arguments. Recieved ${inp.length-1} arguments.`)
    }
    function d(p: string) {
        if (p.startsWith('"') && p.endsWith('"')) return p;
        else if (isNum(p)) return parseInt(p);
        else return p;
    }
    let ins = [inp[0], ...inp.slice(1).map(i => d(i))]
    for (let i = 1; i < ins.length; i++) {
        if (typeof(ins[i]) === syntax[i-1]) {

        } else if (typeof(ins[i]) === "string" && variables.map(v => v.name).includes(ins[i]?.toString() ?? "") && syntax[i-1] === "variable_name") {

        } else if (syntax[i-1] === "variable" || syntax[i-1] === "any") {

        } else {
            throwError(`On instruction "${ins.join(" ")}":\n\tInstruction "${ins[0]}" is used as "${ins[0]} ${syntax.map(s => `<${s}>`).join(" ")}". Expected type "${syntax[i-1]}", got ${typeof(ins[i])}`)
        }
    }
}

let stack: (number | string)[] = [];
let callstack: number[] = [];
async function main() {
    for (let i = 0; i < file.length; i++) {
        var ins = splitTok(file[i])
        if (ins[0] === ("let")) {
            checkSyntax(ins, ["string", "any", "any"], i)
            variables.push({name: ins[1]?.toString() ?? "", value: parseType(ins[3] ?? "") ?? ""})
        } else if (ins[0] === ("set")) {
            checkSyntax(ins, ["variable_name", "any", "any"], i)
            variables.find(e => e.name === ins[1])!.value = parseType(ins[3]) ?? ""
        } else if (ins[0] === 'output') {
            checkSyntax(ins, ["any"], i)
            process.stdout.write(parseType(ins[1] ?? "")?.toString() ?? "")
        } else if (ins[0] === 'push') {
            checkSyntax(ins, ["any"], i)
            stack.push(parseType(ins[1] ?? "") ?? "")
        } else if (ins[0] === 'pop') {
            checkSyntax(ins, ["variable_name"], i)
            variables.find(e => e.name === ins[1])!.value = stack.pop() ?? ""
        } else if (ins[0] === 'mul') {
            checkSyntax(ins, [], i)
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {
                
                stack.push(o*t)
            } else throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments.`)
            
        } else if (ins[0] === 'div') {
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {
                throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments.`)
                stack.push(o/t)
            };
        } else if (ins[0] === 'add') {
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {
                stack.push(o+t)
                
            } else throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments.`)
        } else if (ins[0] === 'sub') {
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {
                
                stack.push(o-t)
            } else throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments.`)
        } else if (ins[0] === 'mod') {
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {
                
                stack.push(o%t)
            } else throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments or there weren't enough elements in the stack.`)
        } else if (ins[0] === 'jmp') {
            let jmpto = ins[1];
            callstack.push(i)
            i = sections.find(sec => sec.name === jmpto)!.line - 1
            continue;
        } else if (ins[0] === 'ifjmp') {
            checkSyntax(ins, ["string"], i)
            let jmpto = ins[1];
            let condition = stack.pop();
            
            if (condition === 1) {
                i = sections.find(sec => sec.name === jmpto)!.line - 1;
                continue;
            }
            
        } else if (ins[0] === 'if') {
            checkSyntax(ins, [], i)
            let condition = stack.pop();
            if (condition === 1) {
                continue;
            } else {i++; continue;}
        } else if (ins[0] === 'ret') {
            if (callstack.length === 0) {
                throwError(`On instruction "${ins.join(" ")}":\n\tNo more elements on callstack on return statement.`)
            }
            //@ts-ignore
            else i = callstack.pop();
            continue;
        } else if (ins[0] === 'end') {
            break;
        } else if (ins[0] === 'equ') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push(o===t ? 1 : 0);
        } else if (ins[0] === 'greater') {
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {
                
                stack.push((o>t) ? 1 : 0);
            } else throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments or not enough elements on stack.`)
            
        } else if (ins[0] === 'lesser') {
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {

                stack.push((o<t) ? 1 : 0);
            } throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments or not enough elements on stack.`)
        } else if (ins[0] === 'grequ') {
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {
                
                stack.push((o>=t) ? 1 : 0);
            } else throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments or not enough elements on stack.`)
        } else if (ins[0] === 'lsequ') {
            let o = stack.pop();
            let t = stack.pop();
            if (typeof(o) === "number" && typeof(t) === "number") {
                
                stack.push((o<=t) ? 1 : 0);
            } else throwError(`On instruction "${ins.join(" ")}":\n\tThe two arguments popped off the stack are not number arguments or not enough elements on stack.`);
        } else if (ins[0] === 'input') {
            checkSyntax(ins, ["string"], i)
            //@ts-ignore
            let t = await readLineSync(parseType(ins[1]))
            stack.push(t)
        } else if (ins[0] === 'tonum') {
            if (stack.length === 0) {checkSyntax(ins, [], i)}
            //@ts-ignore
            else stack.push(parseInt(stack.pop()))
        } else if (ins[0] === 'tostr') {
            if (stack.length === 0) {checkSyntax(ins, [], i)}
            //@ts-ignore
            stack.push((stack.pop().toString()))
        }
        // string builtins
        else if (ins[0] === 'strsplit') {
            if (stack.length === 0) {checkSyntax(ins, [], i)}
            //@ts-ignore
            let str = stack.pop().toString()
            for (var j = str.length-1; j >= 0; j--) {
                stack.push(str[j])
            }
            stack.push(str.length)
        }
        // io
        else if (ins[0] === 'ioread') {
            checkSyntax(ins, ["string"], i)
            stack.push(fs.readFileSync(parseType(ins[1]?.toString() ?? "") ?? "", 'utf8').toString())
        } else if (ins[0] === 'iowrite') {
            checkSyntax(ins, ["string"], i)
            if (stack.length === 0) throwError(`On instruction "${ins.join(" ")}":\n\tThere are no elements on the stack, this instruction requires one element on the stack.`)
            //@ts-ignore
            fs.writeFileSync(parseType(ins[1]?.toString() ?? ""), stack.pop())
        } 
        // stack operations
        else if (ins[0] === 'reverse') {
            stack = stack.reverse()
        } else if (ins[0] === 'stackprint') {
            console.log(stack)
        }
        // end
        else {
            //throwError(`Unknown instruction "${ins[0]}". Are you sure you meant this?`)
        }
        //console.log(stack, callstack, i)
    }

    readline.close()
}

main()
