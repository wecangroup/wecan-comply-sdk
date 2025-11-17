# GitHub Actions - npm Publishing

This workflow automatically publishes the package to npm when a version tag is created.

## Required Configuration

### 1. Create an npm token

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Go to **Account Settings** → **Access Tokens** → **Generate New Token**
3. Select the **Automation** type (recommended for CI/CD)
4. Copy the generated token

### 2. Add the secret to GitHub

1. Go to your GitHub repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Click on **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: paste the npm token you created
6. Click **Add secret**

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
