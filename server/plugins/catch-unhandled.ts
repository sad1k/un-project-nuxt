export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) {
    const sanitizeErrorStack = (error: Error) => {
      if (error.stack) {
        error.stack = error.stack
          .split("\n")
          .map((line) => {
            const match = line.match(/\((.+?):(\d+):(\d+)\)/);
            if (match && !match[1]) {
              return line.replace(/\((.+?):(\d+):(\d+)\)/, "(<unknown>)");
            }
            return line;
          })
          .join("\n");
      }
      return error;
    };

    process.on("unhandledRejection", (reason) => {
      if (reason instanceof Error) {
        const sanitized = sanitizeErrorStack(reason);
        console.error("[Unhandled Rejection]", sanitized.message);
        if (sanitized.stack) {
          console.error(sanitized.stack.split("\n").slice(0, 10).join("\n"));
        }
      }
      else {
        console.error("[Unhandled Rejection]", reason);
      }
    });

    nitroApp.hooks.hook("error", (error) => {
      if (error instanceof Error) {
        sanitizeErrorStack(error);
      }
    });
  }
});
