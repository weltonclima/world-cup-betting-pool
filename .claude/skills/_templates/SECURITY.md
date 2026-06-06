# SECURITY GUIDELINES FOR SKILLS

## Input Validation

### Path Validation
```typescript
// Before using any file path from user input
function validatePath(path: string): boolean {
  // Prevent path traversal
  if (path.includes('..')) return false;

  // Ensure path is within expected directories
  const allowedDirs = ['/docs/cards', 'ai/prd', 'ai/plan', 'ai/spec'];
  return allowedDirs.some(dir => path.startsWith(dir));
}
```

### Task ID Validation
```typescript
// Validate task IDs match expected format
function validateTaskId(taskId: string): boolean {
  return /^TASK-\d{2}$/.test(taskId);
}
```

### File Type Validation
```typescript
// Validate file extensions
function validateFileType(filename: string, allowedExtensions: string[]): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}
```

## Command Execution Safety

### Never Execute Untrusted Code
- Always validate scripts before execution
- Use allowlist approach for commands
- Sanitize all inputs passed to shell commands
- Prefer dedicated tools over shell execution

### Environment Variables
- Never log environment variables
- Use secret management for sensitive data
- Validate env var names match expected patterns
- Don't include secrets in error messages

## Document Processing

### DOCX Files
- Scan for macros before processing
- Use read-only mode when possible
- Validate file size before reading
- Implement timeout for processing

## Secure Defaults

1. **Read operations**: Always use read-only mode
2. **Write operations**: Validate destination paths
3. **Script execution**: Require explicit approval
4. **External integrations**: Validate URLs and endpoints
5. **Data exposure**: Minimize logging of sensitive data

## Implementation Checklist

For each skill that processes user input:
- [ ] Validate all file paths
- [ ] Validate all task IDs
- [ ] Sanitize shell command inputs
- [ ] Check file types before processing
- [ ] Implement proper error handling
- [ ] Don't expose sensitive data in errors
- [ ] Log security-relevant events
- [ ] Use principle of least privilege

## Reporting Security Issues

If you discover a security vulnerability:
1. Document the issue clearly
2. Assess the severity (Critical, High, Medium, Low)
3. Propose a fix
4. Test the fix doesn't break functionality
5. Update this document with the new pattern
