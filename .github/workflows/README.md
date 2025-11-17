# GitHub Actions - npm Publishing

This workflow automatically publishes the package to npm when a version tag is created.

## Required Configuration

### Setup npm Trusted Publisher

This workflow uses npm's Trusted Publisher feature with OIDC authentication, which is more secure than using tokens.

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Go to your package page or **Account Settings** → **Access Tokens**
3. Navigate to **Automation** → **Trusted Publishers**
4. Click **Add Trusted Publisher**
5. Configure the publisher:
   - **Publisher**: Select "GitHub Actions"
   - **Repository**: Enter your GitHub repository in the format `owner/repo-name` (e.g., `wecangroup/wecan-comply-sdk`)
   - **Workflow file**: Enter `.github/workflows/publish.yml`
   - **Environment name**: Leave empty (or specify if using environments)
6. Click **Approve**

**Note**: No GitHub secrets are needed when using Trusted Publishers. The authentication is handled automatically via OIDC.

## Usage

### Automatic publishing via tag

The workflow automatically triggers when you create a Git tag starting with `v`:

```bash
# Create and push a tag
git tag v0.1.0
git push origin v0.1.0
```

**Important**: Make sure the version in `package.json` matches the tag (without the `v` prefix).

### Manual publishing

You can also trigger the workflow manually from the **Actions** tab in GitHub:
1. Go to **Actions**
2. Select the **Publish to npm** workflow
3. Click **Run workflow**

## Workflow

The workflow performs the following steps:

1. ✅ Code checkout
2. ✅ Node.js 18 setup
3. ✅ Dependency installation (`npm ci`)
4. ✅ Project build (`npm run build`)
5. ✅ TypeScript type checking (`npm run typecheck`)
6. ✅ Publishing to npm

## Notes

- The package is published with **public** access (`--access public`)
- The workflow uses `npm ci` for reproducible installation
- The build is automatically executed via the `prepublishOnly` script in `package.json`
