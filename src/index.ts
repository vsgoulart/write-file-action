import { getInput, setFailed, setOutput } from "@actions/core";
import { mkdirP } from "@actions/io";
import { promises } from "fs";
import { dirname } from "path";

const { appendFile, writeFile, stat, readFile } = promises;

main().catch((error) => setFailed(error.message));

function isFileSystemError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" && error !== null && error.hasOwnProperty("code")
  );
}

function isGenericError(error: unknown): error is Error {
  return (
    typeof error === "object" &&
    error !== null &&
    error.hasOwnProperty("code") &&
    typeof (error as { message: unknown }).message === "string"
  );
}

async function main() {
  try {
    const path = getInput("path", { required: true });
    const contents = getInput("contents", { required: true });
    const mode = (getInput("write-mode") || "append").toLocaleLowerCase();

    // Ensure the correct mode is specified
    if (!["append", "overwrite", "preserve", "prepend"].includes(mode)) {
      setFailed("Mode must be one of: overwrite, append, preserve or prepend");
      return;
    }

    // Preserve the file
    if (mode === "preserve") {
      try {
        const statResult = await stat(path);
        setOutput("size", `${statResult.size}`);
        return;
      } catch (error) {
        const doesFileExist = !(
          isFileSystemError(error) && error.code === "ENOENT"
        );

        if (doesFileExist) {
          return;
        }

        if (isGenericError(error)) {
          return setFailed(error);
        }

        return setFailed("Failed to check if file exists in preserve mode");
      }
    }

    const targetDir = dirname(path);

    await mkdirP(targetDir);

    if (["overwrite", "preserve"].includes(mode)) {
      await writeFile(path, contents);
    }

    if (mode === "append") {
      await appendFile(path, contents);
    }

    if (mode === "prepend") {
      const file = await readFile(path);
      await writeFile(path, `${contents}\n${file.toString()}`);
    }

    const statResult = await stat(path);
    setOutput("size", `${statResult.size}`);
  } catch (error) {
    if (isGenericError(error)) {
      return setFailed(error);
    }

    return setFailed("Failed to write to file");
  }
}
