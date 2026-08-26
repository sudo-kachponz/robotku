// src/components/blockcoding/RobotkuCategory.ts
//
// Blockly ToolboxCategory subclass for Robotku visual design system.
import * as Blockly from 'blockly';
import { categoryIconSvg } from '../../visual/categoryIcons';
import { getCategoryTint } from '../../visual/categoryColors';

export class RobotkuCategory extends Blockly.ToolboxCategory {
  private iconEl_?: HTMLDivElement;

  override createDom_() {
    super.createDom_();
    if (this.rowDiv_) {
      this.rowDiv_.classList.add('robotkuToolboxCategory');
      this.rowDiv_.style.setProperty('--cat-color', this.colour_);

      const contentContainer = this.rowDiv_.querySelector(
        '.blocklyTreeRowContentContainer',
      ) as HTMLElement;
      if (contentContainer) {
        contentContainer.classList.add('robotkuToolboxContent');
      }
    }
    const labelDiv =
      (this as any).labelDiv_ ||
      (this.rowDiv_
        ? (this.rowDiv_.querySelector(
            '.blocklyTreeLabel, .blocklyToolboxCategoryLabel',
          ) as HTMLElement)
        : null);
    if (labelDiv) {
      labelDiv.classList.add('robotkuCategoryLabel');
    }
    return this.rowDiv_ as HTMLDivElement;
  }

  override createIconDom_() {
    const icon = document.createElement('div');
    icon.classList.add('categoryBubble');
    icon.classList.add('blocklyTreeIcon');
    icon.classList.add('robotkuCategoryIcon');

    const name = ((this as any).name_ as string) || '';
    const svg = categoryIconSvg(name);
    if (svg) {
      icon.innerHTML = svg;
    } else {
      icon.style.backgroundColor = this.colour_;
      icon.style.borderRadius = '50%';
    }
    this.iconEl_ = icon;
    return icon;
  }

  override setSelected(isSelected: boolean) {
    super.setSelected(isSelected);
    if (this.rowDiv_) {
      if (isSelected) {
        this.rowDiv_.classList.add('selected');
      } else {
        this.rowDiv_.classList.remove('selected');
      }
    }
    if (isSelected) {
      const name = (this as any).name_ as string;
      const tint = getCategoryTint(name);
      document.documentElement.style.setProperty('--flyout-bg-color', tint);
    }
  }
}
