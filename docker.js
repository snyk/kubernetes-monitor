"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const subProcess = require("./sub-process");
class Docker {
    constructor(targetImage, options) {
        this.targetImage = targetImage;
        this.optionsList = Docker.createOptionsList(options);
    }
    static run(args, options) {
        return subProcess.execute("podman", [
            ...Docker.createOptionsList(options),
            ...args,
        ]);
    }
    static createOptionsList(options) {
        const opts = [];
        if (!options) {
            return opts;
        }
        if (options.host) {
            opts.push(`--host=${options.host}`);
        }
        if (options.tlscert) {
            opts.push(`--tlscert=${options.tlscert}`);
        }
        if (options.tlscacert) {
            opts.push(`--tlscacert=${options.tlscacert}`);
        }
        if (options.tlskey) {
            opts.push(`--tlskey=${options.tlskey}`);
        }
        if (options.tlsverify) {
            opts.push(`--tlsverify=${options.tlsverify}`);
        }
        return opts;
    }
    run(cmd, args = []) {
        return subProcess.execute("podman", [
            ...this.optionsList,
            "run",
            "--privileged",
            "--cgroup-manager",
            "cgroupfs",
            "--rm",
            "--entrypoint",
            '""',
            "--network",
            "none",
            this.targetImage,
            cmd,
            ...args,
        ]);
    }
    inspect(targetImage) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield subProcess.execute("podman", [
                ...this.optionsList,
                "inspect",
                targetImage,
            ]);
        });
    }
    catSafe(filename) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.run("cat", [filename]);
            }
            catch (error) {
                const stderr = error.stderr;
                if (typeof stderr === "string") {
                    if (stderr.indexOf("No such file") >= 0 ||
                        stderr.indexOf("file not found") >= 0) {
                        return { stdout: "", stderr: "" };
                    }
                }
                throw error;
            }
        });
    }
}
exports.Docker = Docker;
//# sourceMappingURL=docker.js.map