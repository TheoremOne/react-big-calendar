import PropTypes from 'prop-types';
import React from 'react';
import { findDOMNode } from 'react-dom';
import cn from 'classnames';

import dates from './utils/dates';
import localizer from './localizer';
import chunk from 'lodash/chunk';
import Combokeys from 'combokeys';

import { navigate, views } from './utils/constants';
import { notify } from './utils/helpers';
import getPosition from 'dom-helpers/query/position';
import raf from 'dom-helpers/util/requestAnimationFrame';

import Popup from './Popup';
import Overlay from 'react-overlays/lib/Overlay';
import Header from './Header';
import DateHeader from './DateHeader';

import { accessor, dateFormat } from './utils/propTypes';
import { segStyle, inRange, sortEvents } from './utils/eventLevels';

const combokeys = new Combokeys(document.documentElement);

let eventsForWeek = (evts, start, end, props) => evts.filter(e => inRange(e, start, end, props));

let propTypes = {
  events: PropTypes.array.isRequired,
  date: PropTypes.instanceOf(Date),

  min: PropTypes.instanceOf(Date),
  max: PropTypes.instanceOf(Date),

  step: PropTypes.number,
  now: PropTypes.instanceOf(Date),

  scrollToTime: PropTypes.instanceOf(Date),
  eventPropGetter: PropTypes.func,

  culture: PropTypes.string,
  dayFormat: dateFormat,

  rtl: PropTypes.bool,
  width: PropTypes.number,

  titleAccessor: accessor.isRequired,
  allDayAccessor: accessor.isRequired,
  startAccessor: accessor.isRequired,
  endAccessor: accessor.isRequired,

  selected: PropTypes.object,
  selectedList: PropTypes.array,
  selectable: PropTypes.oneOf([true, false, 'ignoreEvents']),
  longPressThreshold: PropTypes.number,

  onNavigate: PropTypes.func,
  onSelectSlot: PropTypes.func,
  onSelectEvent: PropTypes.func,
  onRightClickSlot: PropTypes.func,
  onDoubleClickEvent: PropTypes.func,
  onShowMore: PropTypes.func,
  onDrillDown: PropTypes.func,
  getDrilldownView: PropTypes.func.isRequired,

  dateFormat,

  weekdayFormat: dateFormat,
  popup: PropTypes.bool,

  messages: PropTypes.object,
  components: PropTypes.object.isRequired,
  popupOffset: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
    }),
  ]),
  calendarId: PropTypes.number,
  activeCalendar: PropTypes.number,
};

class MonthView extends React.Component {
  static displayName = 'MonthView';
  static propTypes = propTypes;

  static defaultProps = {
    now: new Date(),
  };

  constructor(props) {
    super(props);

    this._bgRows = [];
    this._pendingSelection = [];
    this.state = {
      rowLimit: props.showAllEvents ? Infinity : 5,
      needLimitMeasure: props.showAllEvents ? false : true,
    };
  }

  componentWillReceiveProps({ date }) {
    this.setState({
      needLimitMeasure: this.props.showAllEvents ? false : !dates.eq(date, this.props.date),
    });
  }

  componentDidMount() {
    let running;

    if (this.state.needLimitMeasure) this.measureRowLimit(this.props);

    window.addEventListener(
      'resize',
      (this._resizeListener = () => {
        if (!running) {
          raf(() => {
            running = false;
            this.setState({
              needLimitMeasure: this.props.showAllEvents ? false : true,
            }); //eslint-disable-line
          });
        }
      }),
      false,
    );

    combokeys.bind('up', () => {
      this.props.onNavigate(navigate.PREVIOUS_WEEK);
    });

    combokeys.bind('down', () => {
      this.props.onNavigate(navigate.NEXT_WEEK);
    });

    combokeys.bind('left', () => {
      this.props.onNavigate(navigate.PREVIOUS_DAY);
    });

    combokeys.bind('right', () => {
      this.props.onNavigate(navigate.NEXT_DAY);
    });
  }

  generateId(date) {
    return [date.getMonth() + 1, date.getDate(), date.getFullYear()].join('-');
  }

  componentDidUpdate() {
    if (this.state.needLimitMeasure) this.measureRowLimit(this.props);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this._resizeListener, false);
  }

  getContainer = () => {
    return findDOMNode(this);
  };

  render() {
    let { date, culture, weekdayFormat, className } = this.props,
      month = dates.visibleDays(date, culture),
      weeks = chunk(month, 7);

    this._weekCount = weeks.length;

    return (
      <div className={cn('rbc-month-view', className)}>
        <div className="rbc-row rbc-month-header">
          {this.renderHeaders(weeks[0], weekdayFormat, culture)}
        </div>
        {weeks.map((week, idx) => this.renderWeek(week, idx))}
        {this.props.popup && this.renderOverlay()}
      </div>
    );
  }

  renderWeek = (week, weekIdx) => {
    let {
      events,
      components,
      selectable,
      titleAccessor,
      startAccessor,
      endAccessor,
      allDayAccessor,
      eventPropGetter,
      messages,
      selected,
      selectedList,
      now,
      date,
      longPressThreshold,
      eventsSorter,
      onNavigate,
      activeCalendar,
      calendarId,
    } = this.props;

    const { needLimitMeasure, rowLimit } = this.state;

    events = eventsForWeek(events, week[0], week[week.length - 1], this.props);
    events.sort((a, b) => {
      let fn = eventsSorter || sortEvents;
      return fn(a, b, this.props);
    });

    const DateContentRowWrapper = components.dateContentRowWrapper;

    return (
      <DateContentRowWrapper
        allDayAccessor={allDayAccessor}
        className={cn('rbc-month-row', { 'rbc-show-all-events': this.props.showAllEvents })}
        container={this.getContainer}
        date={date}
        dateCellWrapper={components.dateCellWrapper}
        dateContentRowWrapper={components.dateContentRowWrapper}
        endAccessor={endAccessor}
        eventComponent={components.event}
        eventPropGetter={eventPropGetter}
        events={events}
        key={weekIdx}
        level={weekIdx}
        eventWrapperComponent={components.eventWrapper}
        longPressThreshold={longPressThreshold}
        maxRows={rowLimit}
        messages={messages}
        now={now}
        onDoubleClick={this.handleDoubleClickEvent}
        onInlineEditEventTitle={this.props.onInlineEditEventTitle}
        onRightClickSlot={this.handleRightClickSlot}
        onSelect={this.handleSelectEvent}
        onSelectSlot={this.handleSelectSlot}
        onShowMore={this.handleShowMore}
        range={week}
        ref={weekIdx === 0 ? 'slotRow' : undefined}
        renderForMeasure={needLimitMeasure}
        renderHeader={this.readerDateHeading}
        selectable={selectable}
        selected={selected}
        selectedList={selectedList}
        startAccessor={startAccessor}
        titleAccessor={titleAccessor}
        onNavigate={onNavigate}
        activeCalendar={activeCalendar}
        calendarId={calendarId}
      />
    );
  };

  readerDateHeading = ({ date, className, ...props }) => {
    let { date: currentDate, getDrilldownView, dateFormat, culture } = this.props;

    let isOffRange = dates.month(date) !== dates.month(currentDate);
    let isCurrent = dates.eq(date, currentDate, 'day');
    let drilldownView = getDrilldownView(date);
    let label = localizer.format(date, dateFormat, culture);
    let DateHeaderComponent = this.props.components.dateHeader || DateHeader;

    return (
      <div
        {...props}
        className={cn(className, isOffRange && 'rbc-off-range', isCurrent && 'rbc-current')}
      >
        <DateHeaderComponent
          label={label}
          date={date}
          drilldownView={drilldownView}
          isOffRange={isOffRange}
          onDrillDown={e => this.handleHeadingClick(date, drilldownView, e)}
        />
      </div>
    );
  };

  renderHeaders(row, format, culture) {
    let first = row[0];
    let last = row[row.length - 1];
    let HeaderComponent = this.props.components.header || Header;

    return dates.range(first, last, 'day').map((day, idx) => (
      <div key={'header_' + idx} className="rbc-header" style={segStyle(1, 7)}>
        <HeaderComponent
          date={day}
          label={localizer.format(day, format, culture)}
          localizer={localizer}
          format={format}
          culture={culture}
        />
      </div>
    ));
  }

  renderOverlay() {
    let overlay = (this.state && this.state.overlay) || {};
    let { components } = this.props;

    return (
      <Overlay
        rootClose
        placement="bottom"
        container={this}
        show={!!overlay.position}
        onHide={() => this.setState({ overlay: null })}
      >
        <Popup
          {...this.props}
          eventComponent={components.event}
          eventWrapperComponent={components.eventWrapper}
          position={overlay.position}
          events={overlay.events}
          slotStart={overlay.date}
          slotEnd={overlay.end}
          onSelect={this.handleSelectEvent}
        />
      </Overlay>
    );
  }

  measureRowLimit() {
    this.setState({
      needLimitMeasure: false,
      rowLimit: this.refs.slotRow.getRowLimit(),
    });
  }

  handleSelectSlot = (range, slotInfo) => {
    this._pendingSelection = this._pendingSelection.concat(range);

    clearTimeout(this._selectTimer);
    this._selectTimer = setTimeout(() => this.selectDates(slotInfo));
  };

  handleRightClickSlot = (range, slotInfo) => {
    this._pendingSelection = this._pendingSelection.concat(range);

    clearTimeout(this._selectTimer);
    this._selectTimer = setTimeout(() => this.rightClickDates(slotInfo));
  };

  handleHeadingClick = (date, view, e) => {
    e.preventDefault();
    this.clearSelection();
    notify(this.props.onDrillDown, [date, view]);
  };

  handleSelectEvent = (...args) => {
    this.clearSelection();
    notify(this.props.onSelectEvent, args);
  };

  handleDoubleClickEvent = (...args) => {
    this.clearSelection();
    notify(this.props.onDoubleClickEvent, args);
  };

  handleShowMore = (events, date, cell, slot) => {
    const { popup, onDrillDown, onShowMore, getDrilldownView } = this.props;
    //cancel any pending selections so only the event click goes through.
    this.clearSelection();

    if (popup) {
      let position = getPosition(cell, findDOMNode(this));

      this.setState({
        overlay: { date, events, position },
      });
    } else {
      notify(onDrillDown, [date, getDrilldownView(date) || views.DAY]);
    }

    notify(onShowMore, [events, date, slot]);
  };

  selectDates(slotInfo) {
    let slots = this._pendingSelection.slice();

    this._pendingSelection = [];

    slots.sort((a, b) => +a - +b);

    notify(this.props.onSelectSlot, {
      slots,
      start: slots[0],
      end: slots[slots.length - 1],
      action: slotInfo.action,
    });
  }

  rightClickDates(slotInfo) {
    let slots = this._pendingSelection.slice();

    this._pendingSelection = [];

    slots.sort((a, b) => +a - +b);

    notify(this.props.onRightClickSlot, {
      slots,
      start: slots[0],
      end: slots[slots.length - 1],
      action: slotInfo.action,
    });
  }

  clearSelection() {
    clearTimeout(this._selectTimer);
    this._pendingSelection = [];
  }
}

MonthView.navigate = (date, action) => {
  switch (action) {
    case navigate.PREVIOUS:
      return dates.add(date, -1, 'month');

    case navigate.NEXT:
      return dates.add(date, 1, 'month');

    case navigate.NEXT_DAY:
      return dates.add(date, 1, 'day');

    case navigate.PREVIOUS_DAY:
      return dates.add(date, -1, 'day');

    case navigate.NEXT_WEEK:
      return dates.add(date, 7, 'day');

    case navigate.PREVIOUS_WEEK:
      return dates.add(date, -7, 'day');

    default:
      return date;
  }
};

MonthView.title = (date, { formats, culture }) =>
  localizer.format(date, formats.monthHeaderFormat, culture);

export default MonthView;
