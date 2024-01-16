import { Octokit as OctokitLib } from "@octokit/rest";
import octokitCommitMultipleFiles from "octokit-commit-multiple-files";

export const Octokit = OctokitLib.plugin(octokitCommitMultipleFiles);
